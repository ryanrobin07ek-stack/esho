package com.eshop.atelier;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "NearbyBluetooth",
    permissions = {
        @Permission(
            alias = "nearby",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE
            }
        ),
        @Permission(alias = "legacyLocation", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class NearbyBluetoothPlugin extends Plugin {
    private static final String SERVICE_NAME = "Eshop POS Sync";
    private static final UUID SERVICE_UUID = UUID.fromString("1b4d52ee-9f1c-44a2-b868-35dcb145a693");
    private static final int MAX_MESSAGE_BYTES = 64 * 1024;

    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private BluetoothAdapter adapter;
    private BluetoothServerSocket serverSocket;
    private BluetoothSocket connectedSocket;
    private BroadcastReceiver discoveryReceiver;
    private volatile boolean stopped;

    @Override
    public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
    }

    @PluginMethod
    public void startHosting(PluginCall call) {
        if (!ensurePermission(call, "startHostingPermissionResult")) return;
        if (!ensureBluetoothEnabled(call, "startHostingEnabledResult")) return;
        startDiscoverableActivity(call);
    }

    @PermissionCallback
    private void startHostingPermissionResult(PluginCall call) {
        startHosting(call);
    }

    @ActivityCallback
    private void startHostingEnabledResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            call.reject("Bluetooth must be enabled to start nearby sync.");
            return;
        }
        startHosting(call);
    }

    private void startDiscoverableActivity(PluginCall call) {
        Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);
        intent.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 300);
        startActivityForResult(call, intent, "startHostingDiscoverableResult");
    }

    @ActivityCallback
    private void startHostingDiscoverableResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == android.app.Activity.RESULT_CANCELED) {
            call.reject("Bluetooth visibility was declined, so the other phone cannot find this register.");
            return;
        }
        try {
            stopped = false;
            serverSocket = adapter.listenUsingRfcommWithServiceRecord(SERVICE_NAME, SERVICE_UUID);
            startAccepting();
            call.resolve(new JSObject().put("status", "discoverable"));
        } catch (SecurityException exception) {
            call.reject("Bluetooth permission was denied.", exception);
        } catch (IOException exception) {
            call.reject("Could not start the Bluetooth sync receiver.", exception);
        }
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        if (!ensurePermission(call, "startDiscoveryPermissionResult")) return;
        if (!ensureBluetoothEnabled(call, "startDiscoveryEnabledResult")) return;
        beginDiscovery(call);
    }

    @PermissionCallback
    private void startDiscoveryPermissionResult(PluginCall call) {
        startDiscovery(call);
    }

    @ActivityCallback
    private void startDiscoveryEnabledResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            call.reject("Bluetooth must be enabled to find nearby registers.");
            return;
        }
        startDiscovery(call);
    }

    private void beginDiscovery(PluginCall call) {
        try {
            stopped = false;
            registerDiscoveryReceiver();
            if (adapter.isDiscovering()) adapter.cancelDiscovery();
            if (!adapter.startDiscovery()) {
                call.reject("Android could not start Bluetooth discovery. Try again.");
                return;
            }
            call.resolve(new JSObject().put("status", "scanning"));
        } catch (SecurityException exception) {
            call.reject("Bluetooth permission was denied.", exception);
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensurePermission(call, "connectPermissionResult")) return;
        if (!ensureBluetoothEnabled(call, "connectEnabledResult")) return;
        connectToDevice(call);
    }

    @PermissionCallback
    private void connectPermissionResult(PluginCall call) {
        connect(call);
    }

    @ActivityCallback
    private void connectEnabledResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            call.reject("Bluetooth must be enabled to connect to the other register.");
            return;
        }
        connect(call);
    }

    private void connectToDevice(PluginCall call) {
        String address = call.getString("address");
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("The selected Bluetooth device address is invalid.");
            return;
        }
        try {
            stopped = false;
            if (adapter.isDiscovering()) adapter.cancelDiscovery();
            BluetoothDevice device = adapter.getRemoteDevice(address);
            new Thread(() -> {
                try {
                    BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SERVICE_UUID);
                    socket.connect();
                    acceptSocket(socket);
                    call.resolve(new JSObject().put("status", "connected"));
                } catch (SecurityException exception) {
                    call.reject("Bluetooth permission was denied.", exception);
                } catch (IOException exception) {
                    call.reject("Could not connect to that register. Keep it discoverable and try again.", exception);
                }
            }, "nearby-bt-connect").start();
        } catch (SecurityException exception) {
            call.reject("Bluetooth permission was denied.", exception);
        }
    }

    @PluginMethod
    public void send(PluginCall call) {
        String message = call.getString("data");
        if (message == null) {
            call.reject("A Bluetooth sync message is required.");
            return;
        }
        byte[] bytes = message.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_MESSAGE_BYTES) {
            call.reject("The Bluetooth sync message exceeds the safe transfer size.");
            return;
        }
        BluetoothSocket socket = connectedSocket;
        if (socket == null || !socket.isConnected()) {
            call.reject("The Bluetooth sync connection is not open.");
            return;
        }
        writer.execute(() -> {
            try {
                DataOutputStream output = new DataOutputStream(socket.getOutputStream());
                output.writeInt(bytes.length);
                output.write(bytes);
                output.flush();
                call.resolve();
            } catch (IOException exception) {
                call.reject("Bluetooth sync lost its connection while sending.", exception);
                closeSocket();
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopped = true;
        closeDiscoveryReceiver();
        try {
            if (adapter != null && adapter.isDiscovering()) adapter.cancelDiscovery();
        } catch (SecurityException ignored) {
            // The user may revoke Bluetooth permissions while the app is open.
        }
        closeSocket();
        closeServer();
        call.resolve();
    }

    private boolean ensurePermission(PluginCall call, String callback) {
        if (adapter == null) {
            call.reject("This device does not have Bluetooth.");
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("nearby") != com.getcapacitor.PermissionState.GRANTED) {
                requestPermissionForAlias("nearby", call, callback);
                return false;
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("legacyLocation", call, callback);
            return false;
        }
        return true;
    }

    private boolean ensureBluetoothEnabled(PluginCall call, String callback) {
        try {
            if (adapter.isEnabled()) return true;
            startActivityForResult(call, new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), callback);
        } catch (SecurityException exception) {
            call.reject("Bluetooth permission was denied.", exception);
        }
        return false;
    }

    private void startAccepting() {
        new Thread(() -> {
            while (!stopped) {
                try {
                    BluetoothServerSocket currentServer = serverSocket;
                    if (currentServer == null) return;
                    BluetoothSocket socket = currentServer.accept();
                    if (socket != null) acceptSocket(socket);
                } catch (IOException exception) {
                    if (!stopped) notifyError("Bluetooth receiver stopped unexpectedly.");
                    return;
                } catch (SecurityException exception) {
                    if (!stopped) notifyError("Bluetooth permission was revoked.");
                    return;
                }
            }
        }, "nearby-bt-accept").start();
    }

    private synchronized void acceptSocket(BluetoothSocket socket) throws IOException {
        if (stopped) {
            socket.close();
            return;
        }
        closeSocket();
        connectedSocket = socket;
        String name = "Nearby register";
        try {
            if (socket.getRemoteDevice().getName() != null) name = socket.getRemoteDevice().getName();
        } catch (SecurityException ignored) {}
        JSObject payload = new JSObject();
        payload.put("deviceName", name);
        notifyListeners("connected", payload);
        new Thread(() -> readMessages(socket), "nearby-bt-read").start();
    }

    private void readMessages(BluetoothSocket socket) {
        try {
            DataInputStream input = new DataInputStream(socket.getInputStream());
            while (!stopped && socket.isConnected()) {
                int length = input.readInt();
                if (length < 1 || length > MAX_MESSAGE_BYTES) throw new IOException("Invalid sync frame length.");
                byte[] bytes = new byte[length];
                input.readFully(bytes);
                JSObject payload = new JSObject();
                payload.put("data", new String(bytes, StandardCharsets.UTF_8));
                notifyListeners("message", payload);
            }
        } catch (IOException exception) {
            if (!stopped) {
                notifyListeners("disconnected", new JSObject());
                closeSocket();
            }
        }
    }

    private void registerDiscoveryReceiver() {
        closeDiscoveryReceiver();
        discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (BluetoothDevice.ACTION_FOUND.equals(intent.getAction())) {
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (device == null) return;
                    JSObject payload = new JSObject();
                    try {
                        payload.put("address", device.getAddress());
                        payload.put("name", device.getName() == null ? "Unknown device" : device.getName());
                        notifyListeners("deviceFound", payload);
                    } catch (SecurityException exception) {
                        notifyError("Bluetooth permission was revoked during device discovery.");
                    }
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(intent.getAction())) {
                    notifyListeners("discoveryFinished", new JSObject());
                }
            }
        };
        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        if (Build.VERSION.SDK_INT >= 33) {
            getContext().registerReceiver(discoveryReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(discoveryReceiver, filter);
        }
    }

    private void notifyError(String message) {
        JSObject payload = new JSObject();
        payload.put("message", message);
        notifyListeners("error", payload);
    }

    private synchronized void closeSocket() {
        BluetoothSocket socket = connectedSocket;
        connectedSocket = null;
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {}
        }
    }

    private synchronized void closeServer() {
        BluetoothServerSocket socket = serverSocket;
        serverSocket = null;
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {}
        }
    }

    private void closeDiscoveryReceiver() {
        if (discoveryReceiver == null) return;
        try {
            getContext().unregisterReceiver(discoveryReceiver);
        } catch (IllegalArgumentException ignored) {}
        discoveryReceiver = null;
    }

    @Override
    protected void handleOnDestroy() {
        stopped = true;
        closeDiscoveryReceiver();
        closeSocket();
        closeServer();
        writer.shutdownNow();
    }
}
