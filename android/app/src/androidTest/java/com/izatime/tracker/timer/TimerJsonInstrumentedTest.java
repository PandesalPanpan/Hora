package com.izatime.tracker.timer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class TimerJsonInstrumentedTest {

    @Test
    public void nativeTimesAreAddedToAWebSessionSnapshot() throws Exception {
        JSONObject active = new JSONObject("{\"id\":\"s1\",\"startedAt\":\"2026-09-21T08:00:00.000Z\",\"activity\":{\"id\":\"study\",\"name\":\"Study\",\"color\":\"#b92f60\"},\"status\":\"running\"}");
        JSONObject stored = TimerJson.activeWithNativeTimes(active);
        assertEquals(1789977600000L, stored.getLong("startedAtMs"));
        assertTrue(stored.has("pausedAtMs"));
    }

    @Test
    public void completionFreezesPausedTimeAtTheActionTimestamp() throws Exception {
        JSONObject active = new JSONObject("{\"id\":\"s1\",\"startedAt\":\"2026-09-21T08:00:00.000Z\",\"activity\":{\"id\":\"study\",\"name\":\"Study\",\"color\":\"#b92f60\"},\"status\":\"paused\",\"pausedAt\":\"2026-09-21T08:01:00.000Z\",\"pausedSeconds\":30}");
        JSONObject completed = TimerJson.completedFromActive(active, 1789977780000L);
        assertEquals("completed", completed.getString("status"));
        assertEquals(150L, completed.getLong("pausedSeconds"));
        assertTrue(completed.isNull("pausedAt"));
        assertEquals("2026-09-21T08:03:00.000Z", completed.getString("finishedAt"));
    }

    @Test
    public void pomodoroPhaseTransitionIsExplicitAndDoesNotAutoAdvance() throws Exception {
        JSONObject active = new JSONObject("{\"id\":\"s1\",\"startedAt\":\"2026-09-21T08:00:00.000Z\",\"activity\":{\"id\":\"study\",\"name\":\"Study\",\"color\":\"#b92f60\"},\"status\":\"running\",\"targetMinutes\":1,\"timerMode\":\"pomodoro\",\"pomodoro\":{\"phase\":\"focus\",\"round\":1,\"focusMinutes\":1,\"breakMinutes\":5,\"totalRounds\":2,\"focusActivity\":{\"id\":\"study\",\"name\":\"Study\",\"color\":\"#b92f60\"}}}");
        assertTrue(TimerJson.phaseReached(active, 1789977660000L));
        JSONObject next = TimerJson.nextPomodoroPhase(active, 1789977660000L);
        assertEquals("break", next.getJSONObject("pomodoro").getString("phase"));
        assertEquals(1, next.getJSONObject("pomodoro").getInt("round"));
    }
}
