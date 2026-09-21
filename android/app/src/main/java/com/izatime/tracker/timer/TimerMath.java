package com.izatime.tracker.timer;

/** Pure timestamp mathematics kept separate so it can be covered without an Android device. */
public final class TimerMath {

    private TimerMath() {}

    public static long trackedSeconds(long startedAtMs, long pausedSeconds, Long pausedAtMs, long nowMs) {
        long elapsed = Math.max(0, (nowMs - startedAtMs) / 1000);
        long paused = Math.max(0, pausedSeconds);
        if (pausedAtMs != null) paused += Math.max(0, (nowMs - pausedAtMs) / 1000);
        return Math.max(0, elapsed - paused);
    }

    public static long chronometerBase(long currentTimeMillis, long trackedSeconds) {
        return currentTimeMillis - Math.max(0, trackedSeconds) * 1000L;
    }

    public static long countdownBase(long currentTimeMillis, long remainingSeconds) {
        return currentTimeMillis + Math.max(0, remainingSeconds) * 1000L;
    }
}
