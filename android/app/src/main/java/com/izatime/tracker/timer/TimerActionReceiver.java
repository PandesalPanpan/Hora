package com.izatime.tracker.timer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Receives immutable Pause/Resume/Finish/Pomodoro commands from the card. */
public class TimerActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getStringExtra(TimerNotificationController.EXTRA_ACTION);
        String sessionId = intent.getStringExtra(TimerNotificationController.EXTRA_SESSION_ID);
        if (action == null || sessionId == null || sessionId.isEmpty()) return;
        TimerNotificationController.applyAction(context, action, sessionId);
    }
}
