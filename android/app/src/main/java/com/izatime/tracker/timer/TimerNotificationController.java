package com.izatime.tracker.timer;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.izatime.tracker.MainActivity;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

/** Owns the one active-session card and its event-driven native controls. */
public final class TimerNotificationController {

    public static final String ACTION_PAUSE = "com.izatime.tracker.timer.PAUSE";
    public static final String ACTION_RESUME = "com.izatime.tracker.timer.RESUME";
    public static final String ACTION_FINISH = "com.izatime.tracker.timer.FINISH";
    public static final String ACTION_START_BREAK = "com.izatime.tracker.timer.START_BREAK";
    public static final String ACTION_START_FOCUS = "com.izatime.tracker.timer.START_FOCUS";
    public static final String ACTION_MILESTONE = "com.izatime.tracker.timer.MILESTONE";
    public static final String ACTION_DISMISSED = "com.izatime.tracker.timer.DISMISSED";
    public static final String ACTION_OPEN_TODAY = "com.izatime.tracker.timer.OPEN_TODAY";
    public static final String EXTRA_ACTION = "iza.timer.action";
    public static final String EXTRA_SESSION_ID = "iza.timer.sessionId";

    public static final String ACTIVE_CHANNEL_ID = "iza-active-timer";
    public static final String ALERT_CHANNEL_ID = "iza-timer-alerts";
    public static final int ACTIVE_NOTIFICATION_ID = 0x495A; // Stable: exactly one active-session card.

    private static final int MILESTONE_REQUEST_CODE = 0x495A01;
    private static final int COLOR = Color.rgb(217, 47, 111);
    private static final String CAPACITOR_MILESTONE_PUBLISHER = "com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher";

    private TimerNotificationController() {}

    public static TimerSnapshotRepository.Mutation syncWebSession(Context context, String sessionJson, long baseRevision) {
        JSONObject before = TimerSnapshotRepository.read(context);
        String previousSessionId = before.optJSONObject("active") == null ? "" : before.optJSONObject("active").optString("id", "");
        TimerSnapshotRepository.Mutation mutation = TimerSnapshotRepository.syncWebSession(context, sessionJson, baseRevision);
        if (!mutation.accepted) return mutation;
        JSONObject active = mutation.snapshot.optJSONObject("active");
        if (active == null) {
            cancelActive(context);
            cancelMilestoneAlarms(context, previousSessionId.isEmpty() ? sessionIdFromJson(sessionJson) : previousSessionId);
        } else {
            if (!previousSessionId.isEmpty() && !previousSessionId.equals(active.optString("id", ""))) {
                cancelMilestoneAlarms(context, previousSessionId);
            }
            cancelMilestoneAlarms(context, active.optString("id", ""));
            showActive(context, active);
            scheduleNativeFallbackMilestone(context, active);
        }
        return mutation;
    }

    public static TimerSnapshotRepository.Mutation applyAction(Context context, String actionType, String sessionId) {
        long occurredAtMs = System.currentTimeMillis();
        TimerSnapshotRepository.Mutation mutation = TimerSnapshotRepository.applyAction(context, actionType, sessionId, occurredAtMs);
        if (!mutation.accepted) return mutation;

        JSONObject active = mutation.snapshot.optJSONObject("active");
        cancelMilestoneAlarms(context, sessionId);
        if (active == null) {
            cancelActive(context);
        } else {
            showActive(context, active);
            if ("resume".equals(actionType) || "startBreak".equals(actionType) || "startFocus".equals(actionType)) {
                scheduleNativeFallbackMilestone(context, active);
            }
        }
        TimerNotificationPlugin.emitAction(mutation.action, mutation.snapshot);
        return mutation;
    }

    public static void cancelMilestone(Context context, String sessionId) {
        cancelMilestoneAlarms(context, sessionId);
    }

    public static void handleMilestone(Context context, String sessionId) {
        JSONObject snapshot = TimerSnapshotRepository.read(context);
        JSONObject active = snapshot.optJSONObject("active");
        if (active == null || !sessionId.equals(active.optString("id", ""))) return;
        if (!TimerJson.phaseReached(active, System.currentTimeMillis())) {
            scheduleNativeFallbackMilestone(context, active);
            return;
        }
        cancelMilestoneAlarms(context, sessionId);
        showActive(context, active);
        showMilestoneAlert(context, active);
    }

    public static void markDismissed(Context context) {
        TimerSnapshotRepository.markNotificationDismissed(context, System.currentTimeMillis());
    }

    private static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel active = new NotificationChannel(ACTIVE_CHANNEL_ID, "Active timer", NotificationManager.IMPORTANCE_LOW);
        active.setDescription("Quiet controls for a timer that is currently tracking.");
        active.enableVibration(false);
        active.setSound(null, null);
        active.setShowBadge(false);
        manager.createNotificationChannel(active);

        NotificationChannel alert = new NotificationChannel(ALERT_CHANNEL_ID, "Timer alerts", NotificationManager.IMPORTANCE_HIGH);
        alert.setDescription("Timeflow and Pomodoro milestone alerts.");
        alert.enableVibration(true);
        alert.setLightColor(COLOR);
        manager.createNotificationChannel(alert);
    }

    private static void showActive(Context context, JSONObject active) {
        ensureChannels(context);
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) return;
        try {
            Notification notification = buildActiveNotification(context, active);
            manager.notify(ACTIVE_NOTIFICATION_ID, notification);
        } catch (SecurityException ignored) {
            // Notification permission denial must never block timer persistence.
        }
    }

    private static Notification buildActiveNotification(Context context, JSONObject active) {
        long nowMs = System.currentTimeMillis();
        long trackedSeconds = TimerJson.activeSeconds(active, nowMs);
        boolean paused = "paused".equals(active.optString("status", "running"));
        boolean pomodoro = TimerJson.isPomodoro(active);
        boolean reached = TimerJson.phaseReached(active, nowMs);
        long remainingSeconds = pomodoro
            ? Math.max(0, active.optInt("targetMinutes", 0) * 60L - trackedSeconds)
            : trackedSeconds;
        String activityName = activityName(active);
        String phaseText = pomodoro ? phaseText(active) : null;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ACTIVE_CHANNEL_ID)
            .setSmallIcon(com.izatime.tracker.R.drawable.ic_stat_hora)
            .setColor(COLOR)
            .setContentTitle(activityName)
            .setContentIntent(openTodayIntent(context))
            .setDeleteIntent(dismissIntent(context))
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setShowWhen(true);

        if (pomodoro) {
            String state = phaseText + (paused ? " · Paused" : reached ? " complete" : "") ;
            builder.setContentText(state);
            if (!paused && !reached) {
                builder.setWhen(TimerMath.countdownBase(nowMs, remainingSeconds));
                builder.setUsesChronometer(true);
                builder.setChronometerCountDown(true);
            } else {
                builder.setSubText(formatDuration(paused ? trackedSeconds : remainingSeconds));
                builder.setShowWhen(false);
            }
        } else {
            builder.setContentText(paused ? formatDuration(trackedSeconds) + " · Paused" : reached ? "Goal reached · keep going" : "Tracking now");
            if (paused) {
                builder.setShowWhen(false);
                builder.setSubText(formatDuration(trackedSeconds));
            } else {
                builder.setWhen(TimerMath.chronometerBase(nowMs, trackedSeconds));
                builder.setUsesChronometer(true);
            }
        }

        if (Build.VERSION.SDK_INT >= 36) {
            // API 36 promotion is a request, not a guarantee. The system and
            // the user decide whether an eligible active timer is promoted.
            builder.setRequestPromotedOngoing(true);
            builder.setShortCriticalText(formatDuration(remainingSeconds));
        }

        if (reached && pomodoro) {
            builder.addAction(action(context, actionLabel(active), actionForPhase(active), active.optString("id", "")));
        } else {
            String action = paused ? ACTION_RESUME : ACTION_PAUSE;
            builder.addAction(action(context, paused ? "Resume" : "Pause", action, active.optString("id", "")));
        }
        builder.addAction(action(context, "Finish", ACTION_FINISH, active.optString("id", "")));
        return builder.build();
    }

    private static NotificationCompat.Action action(Context context, String label, String action, String sessionId) {
        int icon = ACTION_PAUSE.equals(action) ? android.R.drawable.ic_media_pause
            : ACTION_RESUME.equals(action) ? android.R.drawable.ic_media_play
            : ACTION_FINISH.equals(action) ? android.R.drawable.ic_menu_close_clear_cancel
            : android.R.drawable.ic_media_next;
        int requestCode = Math.abs((ACTION_PREFIX(action) + sessionId).hashCode());
        if (requestCode == 0) requestCode = 1;
        Intent intent = new Intent(context, TimerActionReceiver.class)
            .setAction(action)
            .putExtra(EXTRA_ACTION, actionType(action))
            .putExtra(EXTRA_SESSION_ID, sessionId);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Action.Builder(icon, label, pendingIntent).build();
    }

    private static PendingIntent openTodayIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(ACTION_OPEN_TODAY)
            .putExtra("iza.route", "#/today")
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, ACTIVE_NOTIFICATION_ID + 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent dismissIntent(Context context) {
        Intent intent = new Intent(context, TimerDismissReceiver.class).setAction(ACTION_DISMISSED);
        return PendingIntent.getBroadcast(context, ACTIVE_NOTIFICATION_ID + 2, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void cancelActive(Context context) {
        try { NotificationManagerCompat.from(context).cancel(ACTIVE_NOTIFICATION_ID); } catch (SecurityException ignored) {}
    }

    private static void scheduleNativeFallbackMilestone(Context context, JSONObject active) {
        if ("paused".equals(active.optString("status", "running")) || active.optBoolean("targetAcknowledged", false)) return;
        int targetMinutes = active.optInt("targetMinutes", 0);
        if (targetMinutes <= 0) return;
        long now = System.currentTimeMillis();
        long remaining = targetMinutes * 60L - TimerJson.activeSeconds(active, now);
        if (remaining <= 0) return;

        ensureChannels(context);
        AlarmManager alarm = context.getSystemService(AlarmManager.class);
        String sessionId = active.optString("id", "");
        Intent intent = new Intent(context, TimerMilestoneReceiver.class)
            .setAction(ACTION_MILESTONE)
            .putExtra(EXTRA_SESSION_ID, sessionId);
        PendingIntent pending = PendingIntent.getBroadcast(context, MILESTONE_REQUEST_CODE, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        long at = now + remaining * 1000L;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarm.canScheduleExactAlarms()) alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
            else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
        } catch (SecurityException ignored) {
            try { alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending); } catch (SecurityException ignoredAgain) {}
        }
    }

    private static void cancelMilestoneAlarms(Context context, String sessionId) {
        AlarmManager alarm = context.getSystemService(AlarmManager.class);
        Intent nativeIntent = new Intent(context, TimerMilestoneReceiver.class).setAction(ACTION_MILESTONE);
        PendingIntent nativePending = PendingIntent.getBroadcast(context, MILESTONE_REQUEST_CODE, nativeIntent, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (nativePending != null) { alarm.cancel(nativePending); nativePending.cancel(); }

        cancelCapacitorAlarm(context, stableNotificationId("timeflow-milestone", sessionId));
        cancelCapacitorAlarm(context, stableNotificationId("pomodoro-milestone", sessionId));
    }

    private static void cancelCapacitorAlarm(Context context, int id) {
        Intent intent = new Intent().setComponent(new ComponentName(context, CAPACITOR_MILESTONE_PUBLISHER));
        int flags = PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent pending = PendingIntent.getBroadcast(context, id, intent, flags);
        if (pending != null) {
            AlarmManager alarm = context.getSystemService(AlarmManager.class);
            alarm.cancel(pending);
            pending.cancel();
        }
        try { NotificationManagerCompat.from(context).cancel(id); } catch (SecurityException ignored) {}
    }

    private static void showMilestoneAlert(Context context, JSONObject active) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return;
        boolean pomodoro = TimerJson.isPomodoro(active);
        String phase = active.optJSONObject("pomodoro") == null ? "" : active.optJSONObject("pomodoro").optString("phase", "focus");
        String title = pomodoro ? ("break".equals(phase) ? "Break complete" : "Focus complete") : activityName(active) + " goal reached";
        String body = pomodoro
            ? ("break".equals(phase) ? "Choose when you are ready for the next focus round." : "Choose when you are ready to start a break.")
            : "Keep going, or finish when you are ready.";
        Notification notification = new NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setSmallIcon(com.izatime.tracker.R.drawable.ic_stat_hora)
            .setColor(COLOR)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(openTodayIntent(context))
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build();
        try { NotificationManagerCompat.from(context).notify(stableNotificationId(pomodoro ? "pomodoro-milestone" : "timeflow-milestone", active.optString("id", "")), notification); } catch (SecurityException ignored) {}
    }

    private static String activityName(JSONObject active) {
        JSONObject activity = active.optJSONObject("activity");
        return activity == null ? "Hora" : activity.optString("name", "Hora");
    }

    private static String phaseText(JSONObject active) {
        JSONObject pomodoro = active.optJSONObject("pomodoro");
        if (pomodoro == null) return "Pomodoro";
        String phase = "break".equals(pomodoro.optString("phase", "focus")) ? "Break" : "Focus";
        return phase + " · Round " + Math.max(1, pomodoro.optInt("round", 1)) + " of " + Math.max(1, pomodoro.optInt("totalRounds", 4));
    }

    private static String actionLabel(JSONObject active) {
        JSONObject pomodoro = active.optJSONObject("pomodoro");
        return pomodoro != null && "break".equals(pomodoro.optString("phase", "focus")) ? "Start focus" : "Start break";
    }

    private static String actionForPhase(JSONObject active) {
        JSONObject pomodoro = active.optJSONObject("pomodoro");
        return pomodoro != null && "break".equals(pomodoro.optString("phase", "focus")) ? ACTION_START_FOCUS : ACTION_START_BREAK;
    }

    private static String actionType(String action) {
        if (ACTION_PAUSE.equals(action)) return "pause";
        if (ACTION_RESUME.equals(action)) return "resume";
        if (ACTION_FINISH.equals(action)) return "finish";
        if (ACTION_START_BREAK.equals(action)) return "startBreak";
        return "startFocus";
    }

    private static String ACTION_PREFIX(String action) { return "iza:" + action + ":"; }

    private static String formatDuration(long totalSeconds) {
        long seconds = Math.max(0, totalSeconds);
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        long remainder = seconds % 60;
        return hours > 0
            ? String.format(Locale.US, "%d:%02d:%02d", hours, minutes, remainder)
            : String.format(Locale.US, "%02d:%02d", minutes, remainder);
    }

    private static int stableNotificationId(String kind, String key) {
        String value = "iza:" + kind + ":" + key;
        int hash = (int) 0x811c9dc5L;
        for (int index = 0; index < value.length(); index++) {
            hash ^= value.charAt(index);
            hash *= 0x01000193;
        }
        int positive = hash & 0x7fffffff;
        return positive == 0 ? 1 : positive;
    }

    private static String sessionIdFromJson(String sessionJson) {
        if (sessionJson == null) return "";
        try { return new JSONObject(sessionJson).optString("id", ""); } catch (JSONException ignored) { return ""; }
    }
}
