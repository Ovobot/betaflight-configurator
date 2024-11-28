'use strict';


// Used for LED_STRIP
const ledDirectionLetters    = ['n', 'e', 's', 'w', 'u', 'd'];      // in LSB bit order
const ledFunctionLetters     = ['i', 'w', 'f', 'a', 't', 'r', 'c', 'g', 's', 'b', 'l']; // in LSB bit order
const ledBaseFunctionLetters = ['c', 'f', 'a', 'l', 's', 'g', 'r']; // in LSB bit
let ledOverlayLetters        = ['t', 'o', 'b', 'v', 'i', 'w']; // in LSB bit

function MspHelper() {
    const self = this;

    // 0 based index, must be identical to 'baudRates' in 'src/main/io/serial.c' in betaflight
    self.BAUD_RATES = ['AUTO', '9600', '19200', '38400', '57600', '115200',
    '230400', '250000', '400000', '460800', '500000', '921600', '1000000',
    '1500000', '2000000', '2470000'];
    // needs to be identical to 'serialPortFunction_e' in 'src/main/io/serial.h' in betaflight
    self.SERIAL_PORT_FUNCTIONS = {
    'MSP': 0,
    'GPS': 1,
    'TELEMETRY_FRSKY': 2,
    'TELEMETRY_HOTT': 3,
    'TELEMETRY_MSP': 4,
    'TELEMETRY_LTM': 4, // LTM replaced MSP
    'TELEMETRY_SMARTPORT': 5,
    'RX_SERIAL': 6,
    'BLACKBOX': 7,
    'TELEMETRY_MAVLINK': 9,
    'ESC_SENSOR': 10,
    'TBS_SMARTAUDIO': 11,
    'TELEMETRY_IBUS': 12,
    'IRC_TRAMP': 13,
    'RUNCAM_DEVICE_CONTROL': 14, // support communitate with RunCam Device
    'LIDAR_TF': 15,
    'FRSKY_OSD': 16,
    };

    self.REBOOT_TYPES = {
        FIRMWARE: 0,
        BOOTLOADER: 1,
        MSC: 2,
        MSC_UTC: 3,
    };

    self.RESET_TYPES = {
        BASE_DEFAULTS: 0,
        CUSTOM_DEFAULTS: 1,
    };

    self.SIGNATURE_LENGTH = 32;

    self.mspMultipleCache = [];
}

MspHelper.prototype.process_data = function(dataHandler) {
    const self = this;
    const data = dataHandler.dataView; // DataView (allowing us to view arrayBuffer as struct/union)
    const code = dataHandler.code;
    const msgType = dataHandler.messageType;
    const crcError = dataHandler.crcError;
    let buff = [];
    let char = '';
    let flags = 0;

    if (!crcError) {
        if (!dataHandler.unsupported) {
            switch (code) {
                case MSPCodes.MSP_RAW_IMU:
                    // 512 for mpu6050, 256 for mma
                    // currently we are unable to differentiate between the sensor types, so we are goign with 512
                    FC.SENSOR_DATA.gyroscope[0] = data.read16();
                    FC.SENSOR_DATA.gyroscope[1] = data.read16();
                    FC.SENSOR_DATA.gyroscope[2] = data.read16();

                    FC.SENSOR_DATA.accelerometer[0] = data.read16();
                    FC.SENSOR_DATA.accelerometer[1] = data.read16();
                    FC.SENSOR_DATA.accelerometer[2] = data.read16();
                    break;
                case MSPCodes.MSP_ATTITUDE:
                    FC.SENSOR_DATA.kinematics[0] = data.read16();
                    break;
                case MSPCodes.MSP_BATTERY:
                    FC.ANALOG.batt = data.readU8();//parseFloat((data.read32() / 100.0).toFixed(2)); // correct scale factor
                    break;
                case MSPCodes.MSP_ADAPTER:
                    FC.ANALOG.adapter = data.readU8();//parseFloat((data.read32() / 100.0).toFixed(2)); // correct scale factor
                    break;
                case MSPCodes.MSP_FOURCORNER:
                    FC.ANALOG.corner = data.readU8();//parseFloat((data.read32() / 100.0).toFixed(2)); // correct scale factor
                    break;
                case MSPCodes.MSP_BARO:
                    FC.SENSOR_DATA.baro = data.read32();
                    break;
                case MSPCodes.MSP_WATER_BOX:
                    FC.ANALOG.waterstate = data.readU8();
                    break;
                case MSPCodes.MSP_WIFI_RSSI:
                    FC.ANALOG.rssi = data.readU8();
                    break;
                case MSPCodes.MSP_ANALOG:
                    FC.ANALOG.leftMotorAdc = data.readU16();
                    FC.ANALOG.rightMotorAdc = data.readU16();
                    FC.ANALOG.fanAdc = data.readU16();
                    break;
                case MSPCodes.MSP_SET_MOTOR_CONFIG:
                    console.log('Motor Configuration saved');
                    break;
                case MSPCodes.MSP_SET_MOTOR:
                    console.log('Motor Speeds Updated');
                    break;
                case MSPCodes.MSP_SET_FAN:
                    console.log('FAN Speeds Updated');
                    break;
                case MSPCodes.MSP_SET_SPRAY:
                    console.log('Sprayed');
                    break;
                case MSPCodes.MSP_SET_PWMVALUE:
                    break;
                case MSPCodes.MSP_SET_USE_FAN_LEVEL_DYNAMIC_COMP:
                    break;
                case MSPCodes.MSP_SET_USE_FAN_OUTPUT_PID:
                    break;
                case MSPCodes.MSP_SET_MOTOR_VALUE:
                    break;
                case MSPCodes.MSP_SET_SPRAY_VALUE:
                    break;
                case MSPCodes.CMD_VERSION:
                    FC.CONFIG.hw = data.readU8();
                    FC.CONFIG.firmwareVersion = `${data.readU8()}.${data.readU8()}.${data.readU8()}`;
                    FC.CONFIG.apiVersion = `${data.readU8()}.${data.readU8()}.0`;
                    FC.CONFIG.build = data.readU8();
                    break;

                case MSPCodes.MSP_FC_VARIANT:
                    let fcVariantIdentifier = '';
                    for (let i = 0; i < 4; i++) {
                        fcVariantIdentifier += String.fromCharCode(data.readU8());
                    }
                    FC.CONFIG.flightControllerIdentifier = fcVariantIdentifier;
                    break;

                case MSPCodes.MSP_FC_VERSION:
                    FC.CONFIG.flightControllerVersion = `${data.readU8()}.${data.readU8()}.${data.readU8()}`;
                    break;

                case MSPCodes.CMD_BUILD_INFO:
                    const dateLength = 10;
                    buff = [];

                    for (let i = 0; i < dateLength; i++) {
                        buff.push(data.readU8());
                    }
                    buff.push(32); // ascii space

                    const timeLength = 8;
                    for (let i = 0; i < timeLength; i++) {
                        buff.push(data.readU8());
                    }
                    FC.CONFIG.buildInfo = String.fromCharCode.apply(null, buff);
                    break;
                case MSPCodes.MSP_GET_PWMVALUE:
                    FC.OVOBOT_FUNCTION.pwmvalue = data.readU8();
                    break;
                case MSPCodes.MSP_GET_USE_FAN_LEVEL_DYNAMIC_COMP:
                    FC.OVOBOT_FUNCTION.pwmvaluemax = data.readU8();
                    FC.OVOBOT_FUNCTION.pwmvaluemin = data.readU8();
                    break;
                case MSPCodes.MSP_GET_USE_FAN_OUTPUT_PID:
                    FC.OVOBOT_FUNCTION.fanpwmvalueatidel = data.readU8();
                    FC.OVOBOT_FUNCTION.fanpwmmax = data.readU8();
                    FC.OVOBOT_FUNCTION.fanpwmmin = data.readU8();
                    FC.OVOBOT_FUNCTION.defaulttargetfanpwmvalue = data.readU16();
                    FC.OVOBOT_FUNCTION.maxtargetfanpwmvalue = data.readU16();
                    FC.OVOBOT_FUNCTION.mintargetfanpwmvalue = data.readU16();
                    break;
                case MSPCodes.MSP_GET_MOTOR_VALUE:
                    FC.OVOBOT_FUNCTION.minpwmvalue = data.readU8();
                    FC.OVOBOT_FUNCTION.upminpwmvalue = data.readU8();
                    break;
                case MSPCodes.MSP_GET_SPRAY_VALUE:
                    FC.OVOBOT_FUNCTION.waterpump = data.readU8();
                    FC.OVOBOT_FUNCTION.waterpumpduration = data.readU16();
                    FC.OVOBOT_FUNCTION.waterpumpstartangle = data.readU8();
                    FC.OVOBOT_FUNCTION.waterpumpmovecnt = data.readU8();
                    break;
                default:
                    console.log(`Unknown code detected: ${code}`);
            }
        } else {
            console.log(`FC reports unsupported message error: ${code}`);

            if (code === MSPCodes.MSP_SET_REBOOT) {
                TABS.onboard_logging.mscRebootFailedCallback();
            }
        }
    } else {
        console.warn(`code: ${code} - crc failed`);
    }
    // trigger callbacks, cleanup/remove callback after trigger
    for (let i = dataHandler.callbacks.length - 1; i >= 0; i--) { // iterating in reverse because we use .splice which modifies array length
        if (dataHandler.callbacks[i]?.code === code) {
            // save callback reference
            const callback = dataHandler.callbacks[i].callback;
            const callbackOnError = dataHandler.callbacks[i].callbackOnError;

            // remove timeout
            clearInterval(dataHandler.callbacks[i].timer);

            // remove object from array
            dataHandler.callbacks.splice(i, 1);
            if (!crcError || callbackOnError) {
                // fire callback
                if (callback) callback({'command': code, 'data': data, 'length': data.byteLength, 'crcError': crcError});
            } else {
                console.warn(`code: ${code} - crc failed. No callback`);
            }
        }
    }
};

/**
 * Encode the request body for the MSP request with the given code and return it as an array of bytes.
 */
MspHelper.prototype.crunch = function(code) {
    const buffer = [];
    const self = this;

    switch (code) {
        case MSPCodes.MSP_SET_FEATURE_CONFIG:
            const featureMask = FC.FEATURE_CONFIG.features.getMask();
            buffer.push32(featureMask);
            break;
        case MSPCodes.MSP_SET_BEEPER_CONFIG:
            const beeperDisabledMask = FC.BEEPER_CONFIG.beepers.getDisabledMask();
            buffer.push32(beeperDisabledMask);
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_37)) {
                buffer.push8(FC.BEEPER_CONFIG.dshotBeaconTone);
            }
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_39)) {
                buffer.push32(FC.BEEPER_CONFIG.dshotBeaconConditions.getDisabledMask());
            }
            break;
        case MSPCodes.MSP_SET_MIXER_CONFIG:
            buffer.push8(FC.MIXER_CONFIG.mixer);
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_36)) {
                buffer.push8(FC.MIXER_CONFIG.reverseMotorDir);
            }
            break;
        case MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG:
            buffer.push16(FC.BOARD_ALIGNMENT_CONFIG.roll)
                .push16(FC.BOARD_ALIGNMENT_CONFIG.pitch)
                .push16(FC.BOARD_ALIGNMENT_CONFIG.yaw);
            break;
        case MSPCodes.MSP_SET_PID_CONTROLLER:
            buffer.push8(FC.PID.controller);
            break;
        case MSPCodes.MSP_SET_PID:
            for (let i = 0; i < FC.PIDS.length; i++) {
                for (let j = 0; j < 3; j++) {
                    buffer.push8(parseInt(FC.PIDS[i][j]));
                }
            }
            break;
        case MSPCodes.MSP_SET_RC_TUNING:
            buffer.push8(Math.round(FC.RC_TUNING.RC_RATE * 100))
                .push8(Math.round(FC.RC_TUNING.RC_EXPO * 100));
            if (semver.lt(FC.CONFIG.apiVersion, "1.7.0")) {
                buffer.push8(Math.round(FC.RC_TUNING.roll_pitch_rate * 100));
            } else {
                buffer.push8(Math.round(FC.RC_TUNING.roll_rate * 100))
                    .push8(Math.round(FC.RC_TUNING.pitch_rate * 100));
            }
            buffer.push8(Math.round(FC.RC_TUNING.yaw_rate * 100))
                .push8(Math.round(FC.RC_TUNING.dynamic_THR_PID * 100))
                .push8(Math.round(FC.RC_TUNING.throttle_MID * 100))
                .push8(Math.round(FC.RC_TUNING.throttle_EXPO * 100));
            if (semver.gte(FC.CONFIG.apiVersion, "1.7.0")) {
                buffer.push16(FC.RC_TUNING.dynamic_THR_breakpoint);
            }
            if (semver.gte(FC.CONFIG.apiVersion, "1.10.0")) {
                buffer.push8(Math.round(FC.RC_TUNING.RC_YAW_EXPO * 100));
                if (semver.gte(FC.CONFIG.apiVersion, "1.16.0")) {
                    buffer.push8(Math.round(FC.RC_TUNING.rcYawRate * 100));
                }
            }
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_37)) {
                buffer.push8(Math.round(FC.RC_TUNING.rcPitchRate * 100));
                buffer.push8(Math.round(FC.RC_TUNING.RC_PITCH_EXPO * 100));
            }
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                buffer.push8(FC.RC_TUNING.throttleLimitType);
                buffer.push8(FC.RC_TUNING.throttleLimitPercent);
            }
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                buffer.push16(FC.RC_TUNING.roll_rate_limit);
                buffer.push16(FC.RC_TUNING.pitch_rate_limit);
                buffer.push16(FC.RC_TUNING.yaw_rate_limit);
            }
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
                buffer.push8(FC.RC_TUNING.rates_type);
            }
            break;
        case MSPCodes.MSP_SET_RX_MAP:
            for (let i = 0; i < FC.RC_MAP.length; i++) {
                buffer.push8(FC.RC_MAP[i]);
            }
            break;
        case MSPCodes.MSP_SET_ACC_TRIM:
            buffer.push16(FC.CONFIG.accelerometerTrims[0])
                .push16(FC.CONFIG.accelerometerTrims[1]);
            break;
        case MSPCodes.MSP_SET_ARMING_CONFIG:
            buffer.push8(FC.ARMING_CONFIG.auto_disarm_delay)
                .push8(FC.ARMING_CONFIG.disarm_kill_switch);
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_37)) {
                buffer.push8(FC.ARMING_CONFIG.small_angle);
            }
            break;
        case MSPCodes.MSP_SET_LOOP_TIME:
            buffer.push16(FC.FC_CONFIG.loopTime);
            break;
        case MSPCodes.MSP_SET_MISC:
            buffer.push16(FC.RX_CONFIG.midrc)
                .push16(FC.MOTOR_CONFIG.minthrottle)
                .push16(FC.MOTOR_CONFIG.maxthrottle)
                .push16(FC.MOTOR_CONFIG.mincommand)
                .push16(FC.MISC.failsafe_throttle)
                .push8(FC.GPS_CONFIG.provider)
                .push8(FC.MISC.gps_baudrate)
                .push8(FC.GPS_CONFIG.ublox_sbas)
                .push8(FC.MISC.multiwiicurrentoutput)
                .push8(FC.RSSI_CONFIG.channel)
                .push8(FC.MISC.placeholder2)
                .push16(0) // was mag_declination
                .push8(FC.MISC.vbatscale)
                .push8(Math.round(FC.MISC.vbatmincellvoltage * 10))
                .push8(Math.round(FC.MISC.vbatmaxcellvoltage * 10))
                .push8(Math.round(FC.MISC.vbatwarningcellvoltage * 10));
            break;
        case MSPCodes.MSP_SET_MOTOR_CONFIG:
            buffer.push16(FC.MOTOR_CONFIG.minthrottle)
                .push16(FC.MOTOR_CONFIG.maxthrottle)
                .push16(FC.MOTOR_CONFIG.mincommand);
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                buffer.push8(FC.MOTOR_CONFIG.motor_poles);
                buffer.push8(FC.MOTOR_CONFIG.use_dshot_telemetry ? 1 : 0);
            }
            break;
        case MSPCodes.MSP_SET_GPS_CONFIG:
            buffer.push8(FC.GPS_CONFIG.provider)
                .push8(FC.GPS_CONFIG.ublox_sbas);
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_34)) {
                buffer.push8(FC.GPS_CONFIG.auto_config)
                    .push8(FC.GPS_CONFIG.auto_baud);

                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
                    buffer.push8(FC.GPS_CONFIG.home_point_once)
                          .push8(FC.GPS_CONFIG.ublox_use_galileo);
                }
            }
            break;
        case MSPCodes.MSP_SET_GPS_RESCUE:
            buffer.push16(FC.GPS_RESCUE.angle)
                  .push16(FC.GPS_RESCUE.initialAltitudeM)
                  .push16(FC.GPS_RESCUE.descentDistanceM)
                  .push16(FC.GPS_RESCUE.rescueGroundspeed)
                  .push16(FC.GPS_RESCUE.throttleMin)
                  .push16(FC.GPS_RESCUE.throttleMax)
                  .push16(FC.GPS_RESCUE.throttleHover)
                  .push8(FC.GPS_RESCUE.sanityChecks)
                  .push8(FC.GPS_RESCUE.minSats);

                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
                    buffer.push16(FC.GPS_RESCUE.ascendRate)
                          .push16(FC.GPS_RESCUE.descendRate)
                          .push8(FC.GPS_RESCUE.allowArmingWithoutFix)
                          .push8(FC.GPS_RESCUE.altitudeMode);
                }
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_44)) {
                    buffer.push16(FC.GPS_RESCUE.minRescueDth);
                }
            break;
        case MSPCodes.MSP_SET_RSSI_CONFIG:
            buffer.push8(FC.RSSI_CONFIG.channel);
            break;
        case MSPCodes.MSP_SET_BATTERY_CONFIG:
            buffer.push8(Math.round(FC.BATTERY_CONFIG.vbatmincellvoltage * 10))
                .push8(Math.round(FC.BATTERY_CONFIG.vbatmaxcellvoltage * 10))
                .push8(Math.round(FC.BATTERY_CONFIG.vbatwarningcellvoltage * 10))
                .push16(FC.BATTERY_CONFIG.capacity)
                .push8(FC.BATTERY_CONFIG.voltageMeterSource)
                .push8(FC.BATTERY_CONFIG.currentMeterSource);
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                    buffer.push16(Math.round(FC.BATTERY_CONFIG.vbatmincellvoltage * 100))
                        .push16(Math.round(FC.BATTERY_CONFIG.vbatmaxcellvoltage * 100))
                        .push16(Math.round(FC.BATTERY_CONFIG.vbatwarningcellvoltage * 100));
                }
            break;
        case MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG:
            if (semver.lt(FC.CONFIG.apiVersion, API_VERSION_1_36)) {
                buffer.push8(FC.MISC.vbatscale)
                    .push8(Math.round(FC.MISC.vbatmincellvoltage * 10))
                    .push8(Math.round(FC.MISC.vbatmaxcellvoltage * 10))
                    .push8(Math.round(FC.MISC.vbatwarningcellvoltage * 10));
                    if (semver.gte(FC.CONFIG.apiVersion, "1.23.0")) {
                        buffer.push8(FC.MISC.batterymetertype);
                    }
            }
           break;
        case MSPCodes.MSP_SET_CURRENT_METER_CONFIG:
            if (semver.lt(FC.CONFIG.apiVersion, API_VERSION_1_36))  {
                buffer.push16(FC.BF_CONFIG.currentscale)
                    .push16(FC.BF_CONFIG.currentoffset)
                    .push8(FC.BF_CONFIG.currentmetertype)
                    .push16(FC.BF_CONFIG.batterycapacity);
            }
            break;

        case MSPCodes.MSP_SET_RX_CONFIG:
            buffer.push8(FC.RX_CONFIG.serialrx_provider)
                .push16(FC.RX_CONFIG.stick_max)
                .push16(FC.RX_CONFIG.stick_center)
                .push16(FC.RX_CONFIG.stick_min)
                .push8(FC.RX_CONFIG.spektrum_sat_bind)
                .push16(FC.RX_CONFIG.rx_min_usec)
                .push16(FC.RX_CONFIG.rx_max_usec);
            if (semver.gte(FC.CONFIG.apiVersion, "1.20.0")) {
                buffer.push8(FC.RX_CONFIG.rcInterpolation)
                    .push8(FC.RX_CONFIG.rcInterpolationInterval)
                    .push16(FC.RX_CONFIG.airModeActivateThreshold);
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_31)) {
                    buffer.push8(FC.RX_CONFIG.rxSpiProtocol)
                        .push32(FC.RX_CONFIG.rxSpiId)
                        .push8(FC.RX_CONFIG.rxSpiRfChannelCount)
                        .push8(FC.RX_CONFIG.fpvCamAngleDegrees);
                    if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_40)) {
                        buffer.push8(FC.RX_CONFIG.rcInterpolationChannels)
                            .push8(FC.RX_CONFIG.rcSmoothingType)
                            .push8(FC.RX_CONFIG.rcSmoothingSetpointCutoff)
                            .push8(FC.RX_CONFIG.rcSmoothingFeedforwardCutoff)
                            .push8(FC.RX_CONFIG.rcSmoothingInputType)
                            .push8(FC.RX_CONFIG.rcSmoothingDerivativeType);
                        if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                            buffer.push8(FC.RX_CONFIG.usbCdcHidType)
                                .push8(FC.RX_CONFIG.rcSmoothingAutoFactor);
                            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_44)) {
                                buffer.push8(FC.RX_CONFIG.rcSmoothingMode);
                            }
                        }
                    }
                }
            }

            break;

        case MSPCodes.MSP_SET_FAILSAFE_CONFIG:
            buffer.push8(FC.FAILSAFE_CONFIG.failsafe_delay)
                .push8(FC.FAILSAFE_CONFIG.failsafe_off_delay)
                .push16(FC.FAILSAFE_CONFIG.failsafe_throttle);
            if (semver.gte(FC.CONFIG.apiVersion, "1.15.0")) {
                buffer.push8(FC.FAILSAFE_CONFIG.failsafe_switch_mode)
                    .push16(FC.FAILSAFE_CONFIG.failsafe_throttle_low_delay)
                    .push8(FC.FAILSAFE_CONFIG.failsafe_procedure);
            }
            break;

        case MSPCodes.MSP_SET_TRANSPONDER_CONFIG:
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_33)) {
                buffer.push8(FC.TRANSPONDER.provider); //
            }
            for (let i = 0; i < FC.TRANSPONDER.data.length; i++) {
                buffer.push8(FC.TRANSPONDER.data[i]);
            }
            break;

        case MSPCodes.MSP_SET_CHANNEL_FORWARDING:
            for (let i = 0; i < FC.SERVO_CONFIG.length; i++) {
                let out = FC.SERVO_CONFIG[i].indexOfChannelToForward;
                if (out == undefined) {
                    out = 255; // Cleanflight defines "CHANNEL_FORWARDING_DISABLED" as "(uint8_t)0xFF"
                }
                buffer.push8(out);
            }
            break;
        case MSPCodes.MSP_SET_CF_SERIAL_CONFIG:
            if (semver.lt(FC.CONFIG.apiVersion, "1.6.0")) {

                for (let i = 0; i < FC.SERIAL_CONFIG.ports.length; i++) {
                    buffer.push8(FC.SERIAL_CONFIG.ports[i].scenario);
                }
                buffer.push32(FC.SERIAL_CONFIG.mspBaudRate)
                    .push32(FC.SERIAL_CONFIG.cliBaudRate)
                    .push32(FC.SERIAL_CONFIG.gpsBaudRate)
                    .push32(FC.SERIAL_CONFIG.gpsPassthroughBaudRate);
            } else {
                for (let i = 0; i < FC.SERIAL_CONFIG.ports.length; i++) {
                    const serialPort = FC.SERIAL_CONFIG.ports[i];

                    buffer.push8(serialPort.identifier);

                    const functionMask = self.serialPortFunctionsToMask(serialPort.functions);
                    buffer.push16(functionMask)
                        .push8(self.BAUD_RATES.indexOf(serialPort.msp_baudrate))
                        .push8(self.BAUD_RATES.indexOf(serialPort.gps_baudrate))
                        .push8(self.BAUD_RATES.indexOf(serialPort.telemetry_baudrate))
                        .push8(self.BAUD_RATES.indexOf(serialPort.blackbox_baudrate));
                }
            }
            break;

        case MSPCodes.MSP2_COMMON_SET_SERIAL_CONFIG:
            buffer.push8(FC.SERIAL_CONFIG.ports.length);

            for (let i = 0; i < FC.SERIAL_CONFIG.ports.length; i++) {
                const serialPort = FC.SERIAL_CONFIG.ports[i];

                buffer.push8(serialPort.identifier);

                const functionMask = self.serialPortFunctionsToMask(serialPort.functions);
                buffer.push32(functionMask)
                    .push8(self.BAUD_RATES.indexOf(serialPort.msp_baudrate))
                    .push8(self.BAUD_RATES.indexOf(serialPort.gps_baudrate))
                    .push8(self.BAUD_RATES.indexOf(serialPort.telemetry_baudrate))
                    .push8(self.BAUD_RATES.indexOf(serialPort.blackbox_baudrate));
            }
            break;

        case MSPCodes.MSP_SET_MOTOR_3D_CONFIG:
            buffer.push16(FC.MOTOR_3D_CONFIG.deadband3d_low)
                .push16(FC.MOTOR_3D_CONFIG.deadband3d_high)
                .push16(FC.MOTOR_3D_CONFIG.neutral);
            if (semver.lt(FC.CONFIG.apiVersion, "1.17.0")) {
                buffer.push16(FC.RC_DEADBAND_CONFIG.deadband3d_throttle);
            }
            break;

        case MSPCodes.MSP_SET_RC_DEADBAND:
            buffer.push8(FC.RC_DEADBAND_CONFIG.deadband)
                .push8(FC.RC_DEADBAND_CONFIG.yaw_deadband)
                .push8(FC.RC_DEADBAND_CONFIG.alt_hold_deadband);
            if (semver.gte(FC.CONFIG.apiVersion, "1.17.0")) {
                buffer.push16(FC.RC_DEADBAND_CONFIG.deadband3d_throttle);
            }
            break;

        case MSPCodes.MSP_SET_SENSOR_ALIGNMENT:
            buffer.push8(FC.SENSOR_ALIGNMENT.align_gyro)
                .push8(FC.SENSOR_ALIGNMENT.align_acc)
                .push8(FC.SENSOR_ALIGNMENT.align_mag);
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                buffer.push8(FC.SENSOR_ALIGNMENT.gyro_to_use)
                .push8(FC.SENSOR_ALIGNMENT.gyro_1_align)
                .push8(FC.SENSOR_ALIGNMENT.gyro_2_align);
            }
            break;
        case MSPCodes.MSP_SET_ADVANCED_CONFIG:
            buffer.push8(FC.PID_ADVANCED_CONFIG.gyro_sync_denom)
                .push8(FC.PID_ADVANCED_CONFIG.pid_process_denom)
                .push8(FC.PID_ADVANCED_CONFIG.use_unsyncedPwm)
                .push8(EscProtocols.ReorderPwmProtocols(FC.CONFIG.apiVersion, FC.PID_ADVANCED_CONFIG.fast_pwm_protocol))
                .push16(FC.PID_ADVANCED_CONFIG.motor_pwm_rate);
            if (semver.gte(FC.CONFIG.apiVersion, "1.24.0")) {
                buffer.push16(FC.PID_ADVANCED_CONFIG.digitalIdlePercent * 100);

                if (semver.gte(FC.CONFIG.apiVersion, "1.25.0")) {
                    let gyroUse32kHz = 0;
                    if (semver.lt(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                        gyroUse32kHz = FC.PID_ADVANCED_CONFIG.gyroUse32kHz;
                    }
                    buffer.push8(gyroUse32kHz);
                    if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                        buffer.push8(FC.PID_ADVANCED_CONFIG.motorPwmInversion)
                              .push8(FC.SENSOR_ALIGNMENT.gyro_to_use) // We don't want to double up on storing this state
                              .push8(FC.PID_ADVANCED_CONFIG.gyroHighFsr)
                              .push8(FC.PID_ADVANCED_CONFIG.gyroMovementCalibThreshold)
                              .push16(FC.PID_ADVANCED_CONFIG.gyroCalibDuration)
                              .push16(FC.PID_ADVANCED_CONFIG.gyroOffsetYaw)
                              .push8(FC.PID_ADVANCED_CONFIG.gyroCheckOverflow)
                              .push8(FC.PID_ADVANCED_CONFIG.debugMode);
                    }
                }
            }
            break;
        case MSPCodes.MSP_SET_FILTER_CONFIG:
            buffer.push8(FC.FILTER_CONFIG.gyro_lowpass_hz)
                .push16(FC.FILTER_CONFIG.dterm_lowpass_hz)
                .push16(FC.FILTER_CONFIG.yaw_lowpass_hz);
            if (semver.gte(FC.CONFIG.apiVersion, "1.20.0")) {
                buffer.push16(FC.FILTER_CONFIG.gyro_notch_hz)
                    .push16(FC.FILTER_CONFIG.gyro_notch_cutoff)
                    .push16(FC.FILTER_CONFIG.dterm_notch_hz)
                    .push16(FC.FILTER_CONFIG.dterm_notch_cutoff);
                if (semver.gte(FC.CONFIG.apiVersion, "1.21.0")) {
                    buffer.push16(FC.FILTER_CONFIG.gyro_notch2_hz)
                        .push16(FC.FILTER_CONFIG.gyro_notch2_cutoff);
                }
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_36)) {
                    buffer.push8(FC.FILTER_CONFIG.dterm_lowpass_type);
                }
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_39)) {
                    let gyro_32khz_hardware_lpf = 0;
                    if (semver.lt(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                        gyro_32khz_hardware_lpf = FC.FILTER_CONFIG.gyro_32khz_hardware_lpf;
                    }
                    buffer.push8(FC.FILTER_CONFIG.gyro_hardware_lpf)
                          .push8(gyro_32khz_hardware_lpf)
                          .push16(FC.FILTER_CONFIG.gyro_lowpass_hz)
                          .push16(FC.FILTER_CONFIG.gyro_lowpass2_hz)
                          .push8(FC.FILTER_CONFIG.gyro_lowpass_type)
                          .push8(FC.FILTER_CONFIG.gyro_lowpass2_type)
                          .push16(FC.FILTER_CONFIG.dterm_lowpass2_hz);
                }
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                    buffer.push8(FC.FILTER_CONFIG.dterm_lowpass2_type)
                          .push16(FC.FILTER_CONFIG.gyro_lowpass_dyn_min_hz)
                          .push16(FC.FILTER_CONFIG.gyro_lowpass_dyn_max_hz)
                          .push16(FC.FILTER_CONFIG.dterm_lowpass_dyn_min_hz)
                          .push16(FC.FILTER_CONFIG.dterm_lowpass_dyn_max_hz);
                }
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                    buffer.push8(FC.FILTER_CONFIG.dyn_notch_range)
                          .push8(FC.FILTER_CONFIG.dyn_notch_width_percent)
                          .push16(FC.FILTER_CONFIG.dyn_notch_q)
                          .push16(FC.FILTER_CONFIG.dyn_notch_min_hz)
                          .push8(FC.FILTER_CONFIG.gyro_rpm_notch_harmonics)
                          .push8(FC.FILTER_CONFIG.gyro_rpm_notch_min_hz);
                }
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
                    buffer.push16(FC.FILTER_CONFIG.dyn_notch_max_hz);
                }
                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_44)) {
                    buffer.push8(FC.FILTER_CONFIG.dyn_lpf_curve_expo)
                          .push8(FC.FILTER_CONFIG.dyn_notch_count);
                }
            }
            break;
        case MSPCodes.MSP_SET_PID_ADVANCED:
            if (semver.gte(FC.CONFIG.apiVersion, "1.16.0")) {
                buffer.push16(FC.ADVANCED_TUNING.rollPitchItermIgnoreRate)
                    .push16(FC.ADVANCED_TUNING.yawItermIgnoreRate)
                    .push16(FC.ADVANCED_TUNING.yaw_p_limit)
                    .push8(FC.ADVANCED_TUNING.deltaMethod)
                    .push8(FC.ADVANCED_TUNING.vbatPidCompensation);

                if (semver.gte(FC.CONFIG.apiVersion, "1.20.0")) {
                    if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_40)) {
                        buffer.push8(FC.ADVANCED_TUNING.feedforwardTransition);
                    } else {
                        buffer.push8(FC.ADVANCED_TUNING.dtermSetpointTransition);
                    }
                    buffer.push8(Math.min(FC.ADVANCED_TUNING.dtermSetpointWeight, 254))
                        .push8(FC.ADVANCED_TUNING.toleranceBand)
                        .push8(FC.ADVANCED_TUNING.toleranceBandReduction)
                        .push8(FC.ADVANCED_TUNING.itermThrottleGain)
                        .push16(FC.ADVANCED_TUNING.pidMaxVelocity)
                        .push16(FC.ADVANCED_TUNING.pidMaxVelocityYaw);

                    if (semver.gte(FC.CONFIG.apiVersion, "1.24.0")) {
                        buffer.push8(FC.ADVANCED_TUNING.levelAngleLimit)
                            .push8(FC.ADVANCED_TUNING.levelSensitivity);

                        if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_36)) {
                            buffer.push16(FC.ADVANCED_TUNING.itermThrottleThreshold)
                                .push16(FC.ADVANCED_TUNING.itermAcceleratorGain);

                            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_39)) {
                                buffer.push16(FC.ADVANCED_TUNING.dtermSetpointWeight);

                                if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_40)) {
                                    buffer.push8(FC.ADVANCED_TUNING.itermRotation)
                                          .push8(FC.ADVANCED_TUNING.smartFeedforward)
                                          .push8(FC.ADVANCED_TUNING.itermRelax)
                                          .push8(FC.ADVANCED_TUNING.itermRelaxType)
                                          .push8(FC.ADVANCED_TUNING.absoluteControlGain)
                                          .push8(FC.ADVANCED_TUNING.throttleBoost)
                                          .push8(FC.ADVANCED_TUNING.acroTrainerAngleLimit)
                                          .push16(FC.ADVANCED_TUNING.feedforwardRoll)
                                          .push16(FC.ADVANCED_TUNING.feedforwardPitch)
                                          .push16(FC.ADVANCED_TUNING.feedforwardYaw)
                                          .push8(FC.ADVANCED_TUNING.antiGravityMode);

                                    if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                                        buffer.push8(FC.ADVANCED_TUNING.dMinRoll)
                                              .push8(FC.ADVANCED_TUNING.dMinPitch)
                                              .push8(FC.ADVANCED_TUNING.dMinYaw)
                                              .push8(FC.ADVANCED_TUNING.dMinGain)
                                              .push8(FC.ADVANCED_TUNING.dMinAdvance)
                                              .push8(FC.ADVANCED_TUNING.useIntegratedYaw)
                                              .push8(FC.ADVANCED_TUNING.integratedYawRelax);

                                        if(semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                                            buffer.push8(FC.ADVANCED_TUNING.itermRelaxCutoff);

                                            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
                                                buffer.push8(FC.ADVANCED_TUNING.motorOutputLimit)
                                                      .push8(FC.ADVANCED_TUNING.autoProfileCellCount)
                                                      .push8(FC.ADVANCED_TUNING.idleMinRpm);

                                                if(semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_44)) {
                                                    buffer.push8(FC.ADVANCED_TUNING.feedforward_averaging)
                                                          .push8(FC.ADVANCED_TUNING.feedforward_smooth_factor)
                                                          .push8(FC.ADVANCED_TUNING.feedforward_boost)
                                                          .push8(FC.ADVANCED_TUNING.vbat_sag_compensation)
                                                          .push8(FC.ADVANCED_TUNING.thrustLinearization);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            break;
        case MSPCodes.MSP_SET_SENSOR_CONFIG:
            buffer.push8(FC.SENSOR_CONFIG.acc_hardware)
                .push8(FC.SENSOR_CONFIG.baro_hardware)
                .push8(FC.SENSOR_CONFIG.mag_hardware);
            break;

        case MSPCodes.MSP_SET_NAME:
            const MSP_BUFFER_SIZE = 64;
            for (let i = 0; i<FC.CONFIG.name.length && i<MSP_BUFFER_SIZE; i++) {
                buffer.push8(FC.CONFIG.name.charCodeAt(i));
            }
            break;

        case MSPCodes.MSP_SET_BLACKBOX_CONFIG:
            buffer.push8(FC.BLACKBOX.blackboxDevice)
                .push8(FC.BLACKBOX.blackboxRateNum)
                .push8(FC.BLACKBOX.blackboxRateDenom);
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_36)) {
                buffer.push16(FC.BLACKBOX.blackboxPDenom);
            }
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_44)) {
                buffer.push8(FC.BLACKBOX.blackboxSampleRate);
            }
            break;

        case MSPCodes.MSP_COPY_PROFILE:
            buffer.push8(FC.COPY_PROFILE.type)
                .push8(FC.COPY_PROFILE.dstProfile)
                .push8(FC.COPY_PROFILE.srcProfile);
            break;
        case MSPCodes.MSP_ARMING_DISABLE:
            let value;
            if (FC.CONFIG.armingDisabled) {
                value = 1;
            } else {
                value = 0;
            }
            buffer.push8(value);

            if (FC.CONFIG.runawayTakeoffPreventionDisabled) {
                value = 1;
            } else {
                value = 0;
            }
            // This will be ignored if `armingDisabled` is true
            buffer.push8(value);

            break;
        case MSPCodes.MSP_SET_RTC:
            const now = new Date();

            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                const timestamp = now.getTime();
                const secs = timestamp / 1000;
                const millis = timestamp % 1000;
                buffer.push32(secs);
                buffer.push16(millis);
            } else {
                buffer.push16(now.getUTCFullYear());
                buffer.push8(now.getUTCMonth() + 1);
                buffer.push8(now.getUTCDate());
                buffer.push8(now.getUTCHours());
                buffer.push8(now.getUTCMinutes());
                buffer.push8(now.getUTCSeconds());
            }

            break;

        case MSPCodes.MSP_SET_VTX_CONFIG:

            buffer.push16(FC.VTX_CONFIG.vtx_frequency)
                  .push8(FC.VTX_CONFIG.vtx_power)
                  .push8(FC.VTX_CONFIG.vtx_pit_mode ? 1 : 0)
                  .push8(FC.VTX_CONFIG.vtx_low_power_disarm);

            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                buffer.push16(FC.VTX_CONFIG.vtx_pit_mode_frequency)
                      .push8(FC.VTX_CONFIG.vtx_band)
                      .push8(FC.VTX_CONFIG.vtx_channel)
                      .push16(FC.VTX_CONFIG.vtx_frequency)
                      .push8(FC.VTX_CONFIG.vtx_table_bands)
                      .push8(FC.VTX_CONFIG.vtx_table_channels)
                      .push8(FC.VTX_CONFIG.vtx_table_powerlevels)
                      .push8(FC.VTX_CONFIG.vtx_table_clear ? 1 : 0);
            }

            break;

        case MSPCodes.MSP_SET_VTXTABLE_POWERLEVEL:

            buffer.push8(FC.VTXTABLE_POWERLEVEL.vtxtable_powerlevel_number)
                  .push16(FC.VTXTABLE_POWERLEVEL.vtxtable_powerlevel_value);

            buffer.push8(FC.VTXTABLE_POWERLEVEL.vtxtable_powerlevel_label.length);
            for (let i = 0; i < FC.VTXTABLE_POWERLEVEL.vtxtable_powerlevel_label.length; i++) {
                buffer.push8(FC.VTXTABLE_POWERLEVEL.vtxtable_powerlevel_label.charCodeAt(i));
            }

            break;

        case MSPCodes.MSP_SET_VTXTABLE_BAND:

            buffer.push8(FC.VTXTABLE_BAND.vtxtable_band_number);

            buffer.push8(FC.VTXTABLE_BAND.vtxtable_band_name.length);
            for (let i = 0; i < FC.VTXTABLE_BAND.vtxtable_band_name.length; i++) {
                buffer.push8(FC.VTXTABLE_BAND.vtxtable_band_name.charCodeAt(i));
            }

            if (FC.VTXTABLE_BAND.vtxtable_band_letter != '') {
                buffer.push8(FC.VTXTABLE_BAND.vtxtable_band_letter.charCodeAt(0));
            } else {
                buffer.push8(' '.charCodeAt(0));
            }
            buffer.push8(FC.VTXTABLE_BAND.vtxtable_band_is_factory_band ? 1 : 0);

            buffer.push8(FC.VTXTABLE_BAND.vtxtable_band_frequencies.length);
            for (let i = 0; i < FC.VTXTABLE_BAND.vtxtable_band_frequencies.length; i++) {
                buffer.push16(FC.VTXTABLE_BAND.vtxtable_band_frequencies[i]);
            }

            break;

        case MSPCodes.MSP_MULTIPLE_MSP:

            while (FC.MULTIPLE_MSP.msp_commands.length > 0) {
                const mspCommand = FC.MULTIPLE_MSP.msp_commands.shift();
                self.mspMultipleCache.push(mspCommand);
                buffer.push8(mspCommand);
            }

            break;

        case MSPCodes.MSP2_SET_MOTOR_OUTPUT_REORDERING:

            buffer.push8(FC.MOTOR_OUTPUT_ORDER.length);
            for (let i = 0; i < FC.MOTOR_OUTPUT_ORDER.length; i++) {
                buffer.push8(FC.MOTOR_OUTPUT_ORDER[i]);
            }

            break;

        case MSPCodes.MSP2_SEND_DSHOT_COMMAND:
            buffer.push8(1);
            break;

        case MSPCodes.MSP_SET_TUNING_SLIDERS:
            buffer.push8(FC.TUNING_SLIDERS.slider_pids_mode)
                  .push8(FC.TUNING_SLIDERS.slider_master_multiplier)
                  .push8(FC.TUNING_SLIDERS.slider_roll_pitch_ratio)
                  .push8(FC.TUNING_SLIDERS.slider_i_gain)
                  .push8(FC.TUNING_SLIDERS.slider_pd_ratio)
                  .push8(FC.TUNING_SLIDERS.slider_pd_gain)
                  .push8(FC.TUNING_SLIDERS.slider_dmin_ratio)
                  .push8(FC.TUNING_SLIDERS.slider_feedforward_gain)
                  .push8(FC.TUNING_SLIDERS.slider_dterm_filter)
                  .push8(FC.TUNING_SLIDERS.slider_dterm_filter_multiplier)
                  .push8(FC.TUNING_SLIDERS.slider_gyro_filter)
                  .push8(FC.TUNING_SLIDERS.slider_gyro_filter_multiplier);

            break;

        default:
            return false;
    }

    return buffer;
};

/**
 * Set raw Rx values over MSP protocol.
 *
 * Channels is an array of 16-bit unsigned integer channel values to be sent. 8 channels is probably the maximum.
 */
MspHelper.prototype.setRawRx = function(channels) {
    const buffer = [];

    for (let i = 0; i < channels.length; i++) {
        buffer.push16(channels[i]);
    }

    MSP.send_message(MSPCodes.MSP_SET_RAW_RC, buffer, false);
};

/**
 * Send a request to read a block of data from the dataflash at the given address and pass that address and a dataview
 * of the returned data to the given callback (or null for the data if an error occured).
 */
MspHelper.prototype.dataflashRead = function(address, blockSize, onDataCallback) {
    let outData = [address & 0xFF, (address >> 8) & 0xFF, (address >> 16) & 0xFF, (address >> 24) & 0xFF];

    if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_31)) {
        outData = outData.concat([blockSize & 0xFF, (blockSize >> 8) & 0xFF]);
    }

    if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_36)) {
        // Allow compression
        outData = outData.concat([1]);
    }

    MSP.send_message(MSPCodes.MSP_DATAFLASH_READ, outData, false, function(response) {
        if (!response.crcError) {
            const chunkAddress = response.data.readU32();

            let headerSize = 4;
            let dataSize = response.data.buffer.byteLength - headerSize;
            let dataCompressionType = 0;
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_31)) {
                headerSize = headerSize + 3;
                dataSize = response.data.readU16();
                dataCompressionType = response.data.readU8();
            }

            // Verify that the address of the memory returned matches what the caller asked for and there was not a CRC error
            if (chunkAddress == address) {
                /* Strip that address off the front of the reply and deliver it separately so the caller doesn't have to
                 * figure out the reply format:
                 */
                if (dataCompressionType == 0) {
                    onDataCallback(address, new DataView(response.data.buffer, response.data.byteOffset + headerSize, dataSize));
                } else if (dataCompressionType == 1) {
                    // Read compressed char count to avoid decoding stray bit sequences as bytes
                    const compressedCharCount = response.data.readU16();

                    // Compressed format uses 2 additional bytes as a pseudo-header to denote the number of uncompressed bytes
                    const compressedArray = new Uint8Array(response.data.buffer, response.data.byteOffset + headerSize + 2, dataSize - 2);
                    const decompressedArray = huffmanDecodeBuf(compressedArray, compressedCharCount, defaultHuffmanTree, defaultHuffmanLenIndex);

                    onDataCallback(address, new DataView(decompressedArray.buffer), dataSize);
                }
            } else {
                // Report address error
                // console.log('Expected address ' + address + ' but received ' + chunkAddress + ' - retrying');
                onDataCallback(address, null);  // returning null to the callback forces a retry
            }
        } else {
            // Report crc error
            // console.log('CRC error for address ' + address + ' - retrying');
            onDataCallback(address, null);  // returning null to the callback forces a retry
        }
    }, true);
};

MspHelper.prototype.sendServoConfigurations = function(onCompleteCallback) {
    let nextFunction = send_next_servo_configuration;

    let servoIndex = 0;

    if (FC.SERVO_CONFIG.length == 0) {
        onCompleteCallback();
    } else {
        nextFunction();
    }


    function send_next_servo_configuration() {

        const buffer = [];

        if (semver.lt(FC.CONFIG.apiVersion, "1.12.0")) {
            // send all in one go
            // 1.9.0 had a bug where the MSP input buffer was too small, limit to 8.
            for (let i = 0; i < FC.SERVO_CONFIG.length && i < 8; i++) {
                buffer.push16(FC.SERVO_CONFIG[i].min)
                    .push16(FC.SERVO_CONFIG[i].max)
                    .push16(FC.SERVO_CONFIG[i].middle)
                    .push8(FC.SERVO_CONFIG[i].rate);
            }
            nextFunction = send_channel_forwarding;
        } else {
            // send one at a time, with index

            const servoConfiguration = FC.SERVO_CONFIG[servoIndex];

            buffer.push8(servoIndex)
                .push16(servoConfiguration.min)
                .push16(servoConfiguration.max)
                .push16(servoConfiguration.middle)
                .push8(servoConfiguration.rate);

            if (semver.lt(FC.CONFIG.apiVersion, API_VERSION_1_33)) {
                buffer.push8(servoConfiguration.angleAtMin)
                    .push8(servoConfiguration.angleAtMax);
            }

            let out = servoConfiguration.indexOfChannelToForward;
            if (out == undefined) {
                out = 255; // Cleanflight defines "CHANNEL_FORWARDING_DISABLED" as "(uint8_t)0xFF"
            }
            buffer.push8(out)
                .push32(servoConfiguration.reversedInputSources);

            // prepare for next iteration
            servoIndex++;
            if (servoIndex == FC.SERVO_CONFIG.length) {
                nextFunction = onCompleteCallback;
            }
        }
        MSP.send_message(MSPCodes.MSP_SET_SERVO_CONFIGURATION, buffer, false, nextFunction);
    }

    function send_channel_forwarding() {
        const buffer = [];

        for (let i = 0; i < FC.SERVO_CONFIG.length; i++) {
            let out = FC.SERVO_CONFIG[i].indexOfChannelToForward;
            if (out == undefined) {
                out = 255; // Cleanflight defines "CHANNEL_FORWARDING_DISABLED" as "(uint8_t)0xFF"
            }
            buffer.push8(out);
        }

        nextFunction = onCompleteCallback;

        MSP.send_message(MSPCodes.MSP_SET_CHANNEL_FORWARDING, buffer, false, nextFunction);
    }
};

MspHelper.prototype.sendModeRanges = function(onCompleteCallback) {
    let nextFunction = send_next_mode_range;

    let modeRangeIndex = 0;

    if (FC.MODE_RANGES.length == 0) {
        onCompleteCallback();
    } else {
        send_next_mode_range();
    }

    function send_next_mode_range() {

        const modeRange = FC.MODE_RANGES[modeRangeIndex];
        const buffer = [];

        buffer.push8(modeRangeIndex)
            .push8(modeRange.id)
            .push8(modeRange.auxChannelIndex)
            .push8((modeRange.range.start - 900) / 25)
            .push8((modeRange.range.end - 900) / 25);

        if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
            const modeRangeExtra = FC.MODE_RANGES_EXTRA[modeRangeIndex];

            buffer.push8(modeRangeExtra.modeLogic)
                .push8(modeRangeExtra.linkedTo);
        }

        // prepare for next iteration
        modeRangeIndex++;
        if (modeRangeIndex == FC.MODE_RANGES.length) {
            nextFunction = onCompleteCallback;
        }
        MSP.send_message(MSPCodes.MSP_SET_MODE_RANGE, buffer, false, nextFunction);
    }
};

MspHelper.prototype.sendAdjustmentRanges = function(onCompleteCallback) {
    let nextFunction = send_next_adjustment_range;

    let adjustmentRangeIndex = 0;

    if (FC.ADJUSTMENT_RANGES.length == 0) {
        onCompleteCallback();
    } else {
        send_next_adjustment_range();
    }


    function send_next_adjustment_range() {

        const adjustmentRange = FC.ADJUSTMENT_RANGES[adjustmentRangeIndex];
        const buffer = [];

        buffer.push8(adjustmentRangeIndex)
            .push8(adjustmentRange.slotIndex)
            .push8(adjustmentRange.auxChannelIndex)
            .push8((adjustmentRange.range.start - 900) / 25)
            .push8((adjustmentRange.range.end - 900) / 25)
            .push8(adjustmentRange.adjustmentFunction)
            .push8(adjustmentRange.auxSwitchChannelIndex);

        // prepare for next iteration
        adjustmentRangeIndex++;
        if (adjustmentRangeIndex == FC.ADJUSTMENT_RANGES.length) {
            nextFunction = onCompleteCallback;

        }
        MSP.send_message(MSPCodes.MSP_SET_ADJUSTMENT_RANGE, buffer, false, nextFunction);
    }
};

MspHelper.prototype.sendVoltageConfig = function(onCompleteCallback) {

    let nextFunction = send_next_voltage_config;

    let configIndex = 0;

    if (FC.VOLTAGE_METER_CONFIGS.length == 0) {
        onCompleteCallback();
    } else {
        send_next_voltage_config();
    }

    function send_next_voltage_config() {
        const buffer = [];

        buffer.push8(FC.VOLTAGE_METER_CONFIGS[configIndex].id)
            .push8(FC.VOLTAGE_METER_CONFIGS[configIndex].vbatscale)
            .push8(FC.VOLTAGE_METER_CONFIGS[configIndex].vbatresdivval)
            .push8(FC.VOLTAGE_METER_CONFIGS[configIndex].vbatresdivmultiplier);

        // prepare for next iteration
        configIndex++;
        if (configIndex == FC.VOLTAGE_METER_CONFIGS.length) {
            nextFunction = onCompleteCallback;
        }

        MSP.send_message(MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG, buffer, false, nextFunction);
    }

};

MspHelper.prototype.sendCurrentConfig = function(onCompleteCallback) {

    let nextFunction = send_next_current_config;

    let configIndex = 0;

    if (FC.CURRENT_METER_CONFIGS.length == 0) {
        onCompleteCallback();
    } else {
        send_next_current_config();
    }

    function send_next_current_config() {
        const buffer = [];

        buffer.push8(FC.CURRENT_METER_CONFIGS[configIndex].id)
            .push16(FC.CURRENT_METER_CONFIGS[configIndex].scale)
            .push16(FC.CURRENT_METER_CONFIGS[configIndex].offset);

        // prepare for next iteration
        configIndex++;
        if (configIndex == FC.CURRENT_METER_CONFIGS.length) {
            nextFunction = onCompleteCallback;
        }

        MSP.send_message(MSPCodes.MSP_SET_CURRENT_METER_CONFIG, buffer, false, nextFunction);
    }

};

MspHelper.prototype.sendLedStripConfig = function(onCompleteCallback) {

    let nextFunction = send_next_led_strip_config;

    let ledIndex = 0;

    if (FC.LED_STRIP.length == 0) {
        onCompleteCallback();
    } else {
        send_next_led_strip_config();
    }

    function send_next_led_strip_config() {

        const led = FC.LED_STRIP[ledIndex];
        const buffer = [];

        buffer.push(ledIndex);

        if (semver.lt(FC.CONFIG.apiVersion, API_VERSION_1_36)) {
            ledOverlayLetters = ['t', 'o', 'b', 'n', 'i', 'w']; // in LSB bit
        }

        if (semver.lt(FC.CONFIG.apiVersion, "1.20.0")) {
            let directionMask = 0;
            for (let directionLetterIndex = 0; directionLetterIndex < led.directions.length; directionLetterIndex++) {
                const bitIndex = ledDirectionLetters.indexOf(led.directions[directionLetterIndex]);
                if (bitIndex >= 0) {
                    directionMask = bit_set(directionMask, bitIndex);
                }
            }
            buffer.push16(directionMask);

            let functionMask = 0;
            for (let functionLetterIndex = 0; functionLetterIndex < led.functions.length; functionLetterIndex++) {
                const bitIndex = ledFunctionLetters.indexOf(led.functions[functionLetterIndex]);
                if (bitIndex >= 0) {
                    functionMask = bit_set(functionMask, bitIndex);
                }
            }
            buffer.push16(functionMask)

                .push8(led.x)
                .push8(led.y)
                .push8(led.color);
        } else {
            let mask = 0;

            mask |= (led.y << 0);
            mask |= (led.x << 4);

            for (let functionLetterIndex = 0; functionLetterIndex < led.functions.length; functionLetterIndex++) {
                const fnIndex = ledBaseFunctionLetters.indexOf(led.functions[functionLetterIndex]);
                if (fnIndex >= 0) {
                    mask |= (fnIndex << 8);
                    break;
                }
            }

            for (let overlayLetterIndex = 0; overlayLetterIndex < led.functions.length; overlayLetterIndex++) {
                const bitIndex = ledOverlayLetters.indexOf(led.functions[overlayLetterIndex]);
                if (bitIndex >= 0) {
                    mask |= bit_set(mask, bitIndex + 12);
                }
            }

            mask |= (led.color << 18);

            for (let directionLetterIndex = 0; directionLetterIndex < led.directions.length; directionLetterIndex++) {
                const bitIndex = ledDirectionLetters.indexOf(led.directions[directionLetterIndex]);
                if (bitIndex >= 0) {
                    mask |= bit_set(mask, bitIndex + 22);
                }
            }

            mask |= (0 << 28); // parameters

            buffer.push32(mask);
        }

        // prepare for next iteration
        ledIndex++;
        if (ledIndex == FC.LED_STRIP.length) {
            nextFunction = onCompleteCallback;
        }

        MSP.send_message(MSPCodes.MSP_SET_LED_STRIP_CONFIG, buffer, false, nextFunction);
    }
};

MspHelper.prototype.sendLedStripColors = function(onCompleteCallback) {
    if (FC.LED_COLORS.length == 0) {
        onCompleteCallback();
    } else {
        const buffer = [];

        for (const color of FC.LED_COLORS) {
            buffer.push16(color.h)
                .push8(color.s)
                .push8(color.v);
        }
        MSP.send_message(MSPCodes.MSP_SET_LED_COLORS, buffer, false, onCompleteCallback);
    }
};

MspHelper.prototype.sendLedStripModeColors = function(onCompleteCallback) {

    let nextFunction = send_next_led_strip_mode_color;
    let index = 0;

    if (FC.LED_MODE_COLORS.length == 0) {
        onCompleteCallback();
    } else {
        send_next_led_strip_mode_color();
    }

    function send_next_led_strip_mode_color() {
        const buffer = [];

        const modeColor = FC.LED_MODE_COLORS[index];

        buffer.push8(modeColor.mode)
            .push8(modeColor.direction)
            .push8(modeColor.color);

        // prepare for next iteration
        index++;
        if (index == FC.LED_MODE_COLORS.length) {
            nextFunction = onCompleteCallback;
        }

        MSP.send_message(MSPCodes.MSP_SET_LED_STRIP_MODECOLOR, buffer, false, nextFunction);
    }
};

MspHelper.prototype.serialPortFunctionMaskToFunctions = function(functionMask) {
    const self = this;
    const functions = [];

    const keys = Object.keys(self.SERIAL_PORT_FUNCTIONS);
    for (const key of keys) {
        const bit = self.SERIAL_PORT_FUNCTIONS[key];
        if (bit_check(functionMask, bit)) {
            functions.push(key);
        }
    }
    return functions;
};

MspHelper.prototype.serialPortFunctionsToMask = function(functions) {
    const self = this;
    let mask = 0;

    for (let index = 0; index < functions.length; index++) {
        const key = functions[index];
        const bitIndex = self.SERIAL_PORT_FUNCTIONS[key];
        if (bitIndex >= 0) {
            mask = bit_set(mask, bitIndex);
        }
    }
    return mask;
};

MspHelper.prototype.sendRxFailConfig = function(onCompleteCallback) {
    let nextFunction = send_next_rxfail_config;

    let rxFailIndex = 0;

    if (FC.RXFAIL_CONFIG.length == 0) {
        onCompleteCallback();
    } else {
        send_next_rxfail_config();
    }

    function send_next_rxfail_config() {

        const rxFail = FC.RXFAIL_CONFIG[rxFailIndex];

        const buffer = [];
        buffer.push8(rxFailIndex)
            .push8(rxFail.mode)
            .push16(rxFail.value);


        // prepare for next iteration
        rxFailIndex++;
        if (rxFailIndex == FC.RXFAIL_CONFIG.length) {
            nextFunction = onCompleteCallback;

        }
        MSP.send_message(MSPCodes.MSP_SET_RXFAIL_CONFIG, buffer, false, nextFunction);
    }
};

MspHelper.prototype.setArmingEnabled = function(doEnable, disableRunawayTakeoffPrevention, onCompleteCallback) {
    if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_37)
        && (FC.CONFIG.armingDisabled === doEnable || FC.CONFIG.runawayTakeoffPreventionDisabled !== disableRunawayTakeoffPrevention)) {

        FC.CONFIG.armingDisabled = !doEnable;
        FC.CONFIG.runawayTakeoffPreventionDisabled = disableRunawayTakeoffPrevention;

        MSP.send_message(MSPCodes.MSP_ARMING_DISABLE, mspHelper.crunch(MSPCodes.MSP_ARMING_DISABLE), false, function () {
            if (doEnable) {
                GUI.log(i18n.getMessage('armingEnabled'));
                if (disableRunawayTakeoffPrevention) {
                    GUI.log(i18n.getMessage('runawayTakeoffPreventionDisabled'));
                } else {
                    GUI.log(i18n.getMessage('runawayTakeoffPreventionEnabled'));
                }
            } else {
                GUI.log(i18n.getMessage('armingDisabled'));
            }

            if (onCompleteCallback) {
                onCompleteCallback();
            }
        });
    } else {
        if (onCompleteCallback) {
            onCompleteCallback();
        }
    }
};

MspHelper.prototype.loadSerialConfig = function(callback) {
    const mspCode = semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43) ? MSPCodes.MSP2_COMMON_SERIAL_CONFIG : MSPCodes.MSP_CF_SERIAL_CONFIG;
    MSP.send_message(mspCode, false, false, callback);
};

MspHelper.prototype.sendSerialConfig = function(callback) {
    const mspCode = semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43) ? MSPCodes.MSP2_COMMON_SET_SERIAL_CONFIG : MSPCodes.MSP_SET_CF_SERIAL_CONFIG;
    MSP.send_message(mspCode, mspHelper.crunch(mspCode), false, callback);
};

MSP.SDCARD_STATE_NOT_PRESENT = 0; //TODO, move these to better place
MSP.SDCARD_STATE_FATAL       = 1;
MSP.SDCARD_STATE_CARD_INIT   = 2;
MSP.SDCARD_STATE_FS_INIT     = 3;
MSP.SDCARD_STATE_READY       = 4;
