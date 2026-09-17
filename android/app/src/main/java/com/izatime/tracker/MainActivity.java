package com.izatime.tracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.izatime.tracker.updates.AppUpdatePlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
