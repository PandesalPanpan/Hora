package com.izatime.tracker.timer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Native fallback used only when a notification action must reschedule a target while JS is asleep. */
public class TimerMilestoneReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String sessionId = intent.getStringExtra(TimerNotificationController.EXTRA_SESSION_ID);
        if (sessionId != null && !sessionId.isEmpty()) TimerNotificationController.handleMilestone(context, sessionId);
    }
}
