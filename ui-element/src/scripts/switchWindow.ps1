Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Keyboard {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        public const int KEYEVENTF_EXTENDEDKEY = 0x1;
        public const int KEYEVENTF_KEYUP = 0x2;
        public const byte VK_MENU = 0x12; // Alt key
        public const byte VK_TAB = 0x09; // Tab key

        public static void AltTab() {
            // Press Alt
            keybd_event(VK_MENU, 0, 0, (UIntPtr)0);
            // Press Tab
            keybd_event(VK_TAB, 0, 0, (UIntPtr)0);
            // Release Tab
            keybd_event(VK_TAB, 0, KEYEVENTF_KEYUP, (UIntPtr)0);
            // Release Alt
            keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, (UIntPtr)0);
        }
    }
"@

# Call the function to simulate Alt-Tab instantly
[Keyboard]::AltTab()
