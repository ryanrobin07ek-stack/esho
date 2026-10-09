package com.eshop.atelier;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProductVisionPlugin.class);
        registerPlugin(NearbyBluetoothPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
