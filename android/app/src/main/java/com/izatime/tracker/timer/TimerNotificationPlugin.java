package com.izatime.tracker.timer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

@CapacitorPlugin(name = "TimerNotification")
public class TimerNotificationPlugin extends Plugin {

    private static volatile WeakReference<TimerNotificationPlugin> instance = new WeakReference<>(null);

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    @PluginMethod
    public void syncActiveTimer(PluginCall call) {
        String sessionJson = call.getString("sessionJson");
        Double requestedRevision = call.getDouble("baseRevision");
        long baseRevision = requestedRevision == null || !Double.isFinite(requestedRevision) ? 0 : requestedRevision.longValue();
        TimerSnapshotRepository.Mutation mutation = TimerNotificationController.syncWebSession(getContext(), sessionJson, baseRevision);
        JSObject result = new JSObject();
        result.put("accepted", mutation.accepted);
        result.put("snapshot", mutation.snapshot);
        call.resolve(result);
    }

    @PluginMethod
    public void getTimerState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("snapshot", TimerSnapshotRepository.read(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void acknowledgeAction(PluginCall call) {
        String actionId = call.getString("actionId");
        if (actionId == null || actionId.isEmpty()) {
            call.reject("The native timer action ID is missing.", "INVALID_ACTION");
            return;
        }
        TimerSnapshotRepository.acknowledge(getContext(), actionId);
        call.resolve();
    }

    @PluginMethod
    public void cancelMilestone(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) {
            call.reject("The timer session ID is missing.", "INVALID_SESSION");
            return;
        }
        TimerNotificationController.cancelMilestone(getContext(), sessionId);
        call.resolve();
    }

    static void emitAction(JSONObject action, JSONObject snapshot) {
        TimerNotificationPlugin plugin = instance.get();
        if (plugin == null || action == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("snapshot", snapshot);
        plugin.notifyListeners("timerAction", data);
    }

    @Override
    protected void handleOnDestroy() {
        TimerNotificationPlugin plugin = instance.get();
        if (plugin == this) instance = new WeakReference<>(null);
        super.handleOnDestroy();
    }
}
