package com.izatime.tracker.timer;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import org.json.JSONException;
import org.json.JSONObject;

/** Small, dependency-free transformations shared by the native timer paths. */
final class TimerJson {

    private TimerJson() {}

    static long timestamp(JSONObject object, String key) {
        long numeric = object.optLong(key + "Ms", Long.MIN_VALUE);
        if (numeric != Long.MIN_VALUE && numeric > 0) return numeric;
        String value = object.optString(key, null);
        if (value == null || value.isEmpty()) return 0;
        for (String pattern : new String[]{"yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'"}) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setLenient(false);
                format.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date parsed = format.parse(value);
                if (parsed != null) return parsed.getTime();
            } catch (ParseException ignored) {
                // Try the next defensively supported ISO shape.
            }
        }
        return 0;
    }

    static String iso(long epochMs) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(epochMs));
    }

    static JSONObject copy(JSONObject source) throws JSONException {
        return new JSONObject(source.toString());
    }

    static JSONObject activeWithNativeTimes(JSONObject source) throws JSONException {
        JSONObject active = copy(source);
        long startedAt = timestamp(active, "startedAt");
        if (startedAt > 0) active.put("startedAtMs", startedAt);
        long pausedAt = timestamp(active, "pausedAt");
        if (pausedAt > 0) active.put("pausedAtMs", pausedAt);
        else active.put("pausedAtMs", JSONObject.NULL);
        if (!active.has("status") || active.isNull("status")) active.put("status", "running");
        if (!active.has("pausedSeconds") || active.isNull("pausedSeconds")) active.put("pausedSeconds", 0);
        return active;
    }

    static long activeSeconds(JSONObject active, long nowMs) {
        long startedAt = timestamp(active, "startedAt");
        if (startedAt <= 0) return 0;
        long elapsed = Math.max(0, (nowMs - startedAt) / 1000);
        long paused = Math.max(0, active.optLong("pausedSeconds", 0));
        if ("paused".equals(active.optString("status", "running"))) {
            long pausedAt = timestamp(active, "pausedAt");
            if (pausedAt > 0) paused += Math.max(0, (nowMs - pausedAt) / 1000);
        }
        return Math.max(0, elapsed - paused);
    }

    static boolean isPomodoro(JSONObject active) {
        return "pomodoro".equals(active.optString("timerMode", "")) || active.optJSONObject("pomodoro") != null;
    }

    static boolean phaseReached(JSONObject active, long nowMs) {
        int targetMinutes = active.optInt("targetMinutes", 0);
        return targetMinutes > 0
            && !active.optBoolean("targetAcknowledged", false)
            && activeSeconds(active, nowMs) >= targetMinutes * 60L;
    }

    static JSONObject completedFromActive(JSONObject source, long finishedAtMs) throws JSONException {
        JSONObject completed = activeWithNativeTimes(source);
        long finalPausedSeconds = Math.max(0, completed.optLong("pausedSeconds", 0));
        if ("paused".equals(completed.optString("status", "running"))) {
            long pausedAt = timestamp(completed, "pausedAt");
            if (pausedAt > 0) finalPausedSeconds += Math.max(0, (finishedAtMs - pausedAt) / 1000);
        }
        completed.put("status", "completed");
        completed.put("pausedAt", JSONObject.NULL);
        completed.put("pausedAtMs", JSONObject.NULL);
        completed.put("pausedSeconds", finalPausedSeconds);
        completed.put("finishedAt", iso(finishedAtMs));
        completed.put("finishedAtMs", finishedAtMs);
        return completed;
    }

    static JSONObject nextPomodoroPhase(JSONObject source, long startedAtMs) throws JSONException {
        JSONObject pomodoro = source.optJSONObject("pomodoro");
        if (pomodoro == null) return null;
        String phase = pomodoro.optString("phase", "focus");
        int round = Math.max(1, pomodoro.optInt("round", 1));
        int totalRounds = Math.max(1, pomodoro.optInt("totalRounds", 4));
        boolean nextIsBreak = "focus".equals(phase);
        int nextRound = nextIsBreak ? round : round + 1;
        if (!nextIsBreak && round >= totalRounds) return null;

        JSONObject next = new JSONObject();
        next.put("id", UUID.randomUUID().toString());
        if (nextIsBreak) {
            next.put("activity", new JSONObject("{\"id\":\"break\",\"name\":\"Break\",\"color\":\"#4d862a\"}"));
            next.put("targetMinutes", Math.max(1, pomodoro.optInt("breakMinutes", 5)));
        } else {
            JSONObject focusActivity = pomodoro.optJSONObject("focusActivity");
            if (focusActivity == null) focusActivity = source.optJSONObject("activity");
            next.put("activity", focusActivity == null ? new JSONObject("{\"id\":\"study\",\"name\":\"Study\",\"color\":\"#b92f60\"}") : copy(focusActivity));
            next.put("targetMinutes", Math.max(1, pomodoro.optInt("focusMinutes", 25)));
        }
        next.put("startedAt", iso(startedAtMs));
        next.put("startedAtMs", startedAtMs);
        next.put("status", "running");
        next.put("pausedAt", JSONObject.NULL);
        next.put("pausedAtMs", JSONObject.NULL);
        next.put("pausedSeconds", 0);
        next.put("timerMode", "pomodoro");
        JSONObject nextPomodoro = copy(pomodoro);
        nextPomodoro.put("phase", nextIsBreak ? "break" : "focus");
        nextPomodoro.put("round", nextRound);
        next.put("pomodoro", nextPomodoro);
        return next;
    }
}
