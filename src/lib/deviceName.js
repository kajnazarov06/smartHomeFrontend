// The device-name rule shared by Add device, the detail rename and Settings.
export const DEVICE_NAME_MAX = 64;

/** Error text for an invalid name, or null. */
export const deviceNameError = (name) => (name.trim() ? null : 'Give your clock a name.');
