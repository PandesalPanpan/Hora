package com.izatime.tracker;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.izatime.tracker.timer.TimerNotificationController;
import com.izatime.tracker.timer.TimerNotificationPlugin;
import com.izatime.tracker.updates.AppUpdatePlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(TimerNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        routeNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        routeNotificationIntent(intent);
    }

    private void routeNotificationIntent(Intent intent) {
        if (intent == null || !TimerNotificationController.ACTION_OPEN_TODAY.equals(intent.getAction()) || getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript("window.location.hash = '#/today'", null), 150);
    }
}
