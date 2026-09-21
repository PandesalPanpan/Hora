package com.izatime.tracker.timer;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class TimerMathTest {

    @Test
    public void trackedSecondsExcludesTheCurrentPause() {
        long started = 1_000_000L;
        long pausedAt = 1_060_000L;
        assertEquals(30L, TimerMath.trackedSeconds(started, 30L, pausedAt, 2_000_000L));
    }

    @Test
    public void chronometerBaseCountsUpFromTrackedTime() {
        assertEquals(98_000L, TimerMath.chronometerBase(100_000L, 2L));
    }

    @Test
    public void countdownBaseCountsDownToZeroWithoutAServiceTick() {
        assertEquals(160_000L, TimerMath.countdownBase(100_000L, 60L));
    }
}
