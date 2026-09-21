package com.izatime.tracker.timer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Records dismissal without treating it as a timer mutation or reposting immediately. */
public class TimerDismissReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        TimerNotificationController.markDismissed(context);
    }
}
