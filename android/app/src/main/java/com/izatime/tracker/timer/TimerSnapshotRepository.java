package com.izatime.tracker.timer;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Versioned, deliberately small native continuity store. It mirrors only the
 * active timer and native actions; Dexie remains the web domain store.
 */
public final class TimerSnapshotRepository {

    public static final int SNAPSHOT_VERSION = 1;
    private static final String PREFS = "iza-active-timer-native";
    private static final String SNAPSHOT_KEY = "snapshot";

    private TimerSnapshotRepository() {}

    public static synchronized JSONObject emptySnapshot() {
        JSONObject snapshot = new JSONObject();
        try {
            snapshot.put("version", SNAPSHOT_VERSION);
            snapshot.put("revision", 0);
            snapshot.put("updatedAtMs", 0);
            snapshot.put("active", JSONObject.NULL);
            snapshot.put("pendingActions", new JSONArray());
        } catch (JSONException ignored) {
            // JSONObject.put only fails for an invalid key, which cannot occur here.
        }
        return snapshot;
    }

    public static synchronized JSONObject read(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = preferences.getString(SNAPSHOT_KEY, null);
        if (raw == null || raw.isEmpty()) return emptySnapshot();
        try {
            JSONObject snapshot = new JSONObject(raw);
            if (!snapshot.has("version")) snapshot.put("version", SNAPSHOT_VERSION);
            if (!snapshot.has("revision")) snapshot.put("revision", 0);
            if (!snapshot.has("updatedAtMs")) snapshot.put("updatedAtMs", 0);
            if (!snapshot.has("active")) snapshot.put("active", JSONObject.NULL);
            if (!(snapshot.opt("pendingActions") instanceof JSONArray)) snapshot.put("pendingActions", new JSONArray());
            return snapshot;
        } catch (JSONException ignored) {
            return emptySnapshot();
        }
    }

    private static void write(Context context, JSONObject snapshot) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(SNAPSHOT_KEY, snapshot.toString())
            .apply();
    }

    public static synchronized Mutation syncWebSession(Context context, String sessionJson, long baseRevision) {
        JSONObject current = read(context);
        long revision = current.optLong("revision", 0);
        if (revision > baseRevision) return new Mutation(false, current, null);

        try {
            JSONObject active = null;
            if (sessionJson != null && !sessionJson.isEmpty() && !"null".equals(sessionJson)) {
                active = TimerJson.activeWithNativeTimes(new JSONObject(sessionJson));
                if ("completed".equals(active.optString("status", "running"))) active = null;
            }
            JSONObject next = nextSnapshot(current, active, revision + 1, System.currentTimeMillis());
            write(context, next);
            return new Mutation(true, next, null);
        } catch (JSONException ignored) {
            return new Mutation(false, current, null);
        }
    }

    public static synchronized JSONObject acknowledge(Context context, String actionId) {
        JSONObject snapshot = read(context);
        JSONArray current = snapshot.optJSONArray("pendingActions");
        JSONArray remaining = new JSONArray();
        if (current != null) {
            for (int index = 0; index < current.length(); index++) {
                JSONObject action = current.optJSONObject(index);
                if (action != null && !actionId.equals(action.optString("actionId", ""))) remaining.put(action);
            }
        }
        try { snapshot.put("pendingActions", remaining); } catch (JSONException ignored) {}
        write(context, snapshot);
        return snapshot;
    }

    public static synchronized JSONObject markNotificationDismissed(Context context, long dismissedAtMs) {
        JSONObject snapshot = read(context);
        try { snapshot.put("notificationDismissedAtMs", dismissedAtMs); } catch (JSONException ignored) {}
        write(context, snapshot);
        return snapshot;
    }

    public static synchronized Mutation applyAction(Context context, String actionType, String sessionId, long occurredAtMs) {
        JSONObject current = read(context);
        JSONObject active = current.optJSONObject("active");
        if (active == null || !sessionId.equals(active.optString("id", ""))) return new Mutation(false, current, null);

        try {
            JSONObject nextActive = null;
            JSONObject completed = null;
            String actionId = sessionId + ":" + actionType + ":" + (current.optLong("revision", 0) + 1);
            if ("pause".equals(actionType)) {
                if (!"running".equals(active.optString("status", "running"))) return new Mutation(false, current, null);
                nextActive = TimerJson.activeWithNativeTimes(active);
                nextActive.put("status", "paused");
                nextActive.put("pausedAt", TimerJson.iso(occurredAtMs));
                nextActive.put("pausedAtMs", occurredAtMs);
            } else if ("resume".equals(actionType)) {
                if (!"paused".equals(active.optString("status", ""))) return new Mutation(false, current, null);
                nextActive = TimerJson.activeWithNativeTimes(active);
                long pausedAt = TimerJson.timestamp(nextActive, "pausedAt");
                long addedPause = pausedAt > 0 ? Math.max(0, (occurredAtMs - pausedAt) / 1000) : 0;
                nextActive.put("status", "running");
                nextActive.put("pausedAt", JSONObject.NULL);
                nextActive.put("pausedAtMs", JSONObject.NULL);
                nextActive.put("pausedSeconds", Math.max(0, nextActive.optLong("pausedSeconds", 0)) + addedPause);
            } else if ("finish".equals(actionType)) {
                completed = TimerJson.completedFromActive(active, occurredAtMs);
            } else if ("startBreak".equals(actionType) || "startFocus".equals(actionType)) {
                if (!TimerJson.isPomodoro(active) || !TimerJson.phaseReached(active, occurredAtMs)) return new Mutation(false, current, null);
                JSONObject pomodoro = active.optJSONObject("pomodoro");
                String phase = pomodoro == null ? "" : pomodoro.optString("phase", "focus");
                if ("startBreak".equals(actionType) && !"focus".equals(phase)) return new Mutation(false, current, null);
                if ("startFocus".equals(actionType) && !"break".equals(phase)) return new Mutation(false, current, null);
                completed = TimerJson.completedFromActive(active, occurredAtMs);
                nextActive = TimerJson.nextPomodoroPhase(active, occurredAtMs);
            } else {
                return new Mutation(false, current, null);
            }

            long nextRevision = current.optLong("revision", 0) + 1;
            JSONObject next = nextSnapshot(current, nextActive, nextRevision, occurredAtMs);
            JSONObject action = new JSONObject();
            action.put("actionId", actionId);
            action.put("type", actionType);
            action.put("sessionId", sessionId);
            action.put("occurredAt", TimerJson.iso(occurredAtMs));
            action.put("revision", nextRevision);
            if (nextActive == null && ("pause".equals(actionType) || "resume".equals(actionType))) action.put("active", JSONObject.NULL);
            else if (nextActive != null) action.put("active", nextActive);
            else action.put("active", JSONObject.NULL);
            if (completed != null) action.put("completed", completed);
            appendPending(next, action);
            write(context, next);
            return new Mutation(true, next, action);
        } catch (JSONException ignored) {
            return new Mutation(false, current, null);
        }
    }

    private static JSONObject nextSnapshot(JSONObject current, JSONObject active, long revision, long updatedAtMs) throws JSONException {
        JSONObject next = new JSONObject(current.toString());
        next.put("version", SNAPSHOT_VERSION);
        next.put("revision", revision);
        next.put("updatedAtMs", updatedAtMs);
        next.put("active", active == null ? JSONObject.NULL : active);
        if (!(next.opt("pendingActions") instanceof JSONArray)) next.put("pendingActions", new JSONArray());
        next.remove("notificationDismissedAtMs");
        return next;
    }

    private static void appendPending(JSONObject snapshot, JSONObject action) throws JSONException {
        JSONArray pending = snapshot.optJSONArray("pendingActions");
        if (pending == null) pending = new JSONArray();
        JSONArray next = new JSONArray();
        for (int index = 0; index < pending.length(); index++) next.put(pending.get(index));
        next.put(action);
        snapshot.put("pendingActions", next);
    }

    public static final class Mutation {
        public final boolean accepted;
        public final JSONObject snapshot;
        public final JSONObject action;

        Mutation(boolean accepted, JSONObject snapshot, JSONObject action) {
            this.accepted = accepted;
            this.snapshot = snapshot;
            this.action = action;
        }
    }
}
