'use strict';

TABS.setup = {
    yaw_fix: 0.0,
    sampleCnt:0,
    sampleAccCnt:0,
    bufLen:10,

};

TABS.setup.initialize = function (callback) {
    const self = this;

    if (GUI.active_tab != 'setup') {
        GUI.active_tab = 'setup';
    }

    function load_status() {
        MSP.send_message(MSPCodes.MSP_STATUS, false, false, load_mixer_config);
    }

    function load_mixer_config() {
        MSP.send_message(MSPCodes.MSP_MIXER_CONFIG, false, false, load_html);
    }

    function load_html() {
        $('#content').load("./tabs/setup.html", process_html);
    }

    MSP.send_message(MSPCodes.MSP_ACC_TRIM, false, false, load_status);

    let gyroX = [0,0,0,0,0,0,0,0,0,0];
    let gyroY = [0,0,0,0,0,0,0,0,0,0];
    let gyroZ = [0,0,0,0,0,0,0,0,0,0];

    let accX = [0,0,0,0,0,0,0,0,0,0];
    let accY = [0,0,0,0,0,0,0,0,0,0];
    let accZ = [0,0,0,0,0,0,0,0,0,0];


    function updateGyroData(val1,val2,val3) {

        for (let i = 0; i < self.bufLen - 1; i++) {
            gyroX[i] = gyroX[i + 1];
            gyroY[i] = gyroY[i + 1];
            gyroZ[i] = gyroZ[i + 1];
        }
        gyroX[self.bufLen - 1] = val1;
        gyroY[self.bufLen - 1] = val2;
        gyroZ[self.bufLen - 1] = val3;
        if(self.sampleCnt > self.bufLen) {
            return 1;
        } else {
            self.sampleCnt++;
            return 0;
        }
    }

    function updateAccData(val1,val2,val3) {

        for (let i = 0; i < self.bufLen - 1; i++) {
            accX[i] = accX[i + 1];
            accY[i] = accY[i + 1];
            accZ[i] = accZ[i + 1];
        }
        accX[self.bufLen - 1] = val1;
        accY[self.bufLen - 1] = val2;
        accZ[self.bufLen - 1] = val3;
        if(self.sampleAccCnt > self.bufLen) {
            return 1;
        } else {
            self.sampleAccCnt++;
            return 0;
        }
    }

    function process_html() {
        // translate to user-selected language
        i18n.localizePage();


        const backupButton = $('#content .backup');

        // saving and uploading an imaginary config to hardware is a bad idea
        if (CONFIGURATOR.virtualMode) {
            backupButton.addClass('disabled');
        }


        // set roll in interactive block
        $('span.roll').text(i18n.getMessage('initialSetupAttitude', [0]));
        // set pitch in interactive block
        $('span.pitch').text(i18n.getMessage('initialSetupAttitude', [0]));
        // set heading in interactive block
        $('span.heading').text(i18n.getMessage('initialSetupAttitude', [0]));

        // check if we have accelerometer and magnetometer
        if (!have_sensor(FC.CONFIG.activeSensors, 'acc')) {
            $('a.calibrateAccel').addClass('disabled');
            $('default_btn').addClass('disabled');
        }

        if (!have_sensor(FC.CONFIG.activeSensors, 'mag')) {
            $('a.calibrateMag').addClass('disabled');
            $('default_btn').addClass('disabled');
        }

        self.initializeInstruments();

        $('#arming-disable-flag').attr('title', i18n.getMessage('initialSetupArmingDisableFlagsTooltip'));

        if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_40)) {
            if (isExpertModeEnabled()) {
                $('.initialSetupRebootBootloader').show();
            } else {
                $('.initialSetupRebootBootloader').hide();
            }

            $('a.rebootBootloader').click(function () {
                const buffer = [];
                buffer.push(mspHelper.REBOOT_TYPES.BOOTLOADER);
                MSP.send_message(MSPCodes.MSP_SET_REBOOT, buffer, false);
            });
        } else {
            $('.initialSetupRebootBootloader').hide();
        }

        // UI Hooks
        $('a.calibrateAccel').click(function () {
            const _self = $(this);

            if (!_self.hasClass('calibrating')) {
                _self.addClass('calibrating');

                // During this period MCU won't be able to process any serial commands because its locked in a for/while loop
                // until this operation finishes, sending more commands through data_poll() will result in serial buffer overflow
                GUI.interval_pause('setup_data_pull');
                MSP.send_message(MSPCodes.MSP_ACC_CALIBRATION, false, false, function () {
                    GUI.log(i18n.getMessage('initialSetupAccelCalibStarted'));
                    $('#accel_calib_running').show();
                    $('#accel_calib_rest').hide();
                });

                GUI.timeout_add('button_reset', function () {
                    GUI.interval_resume('setup_data_pull');

                    GUI.log(i18n.getMessage('initialSetupAccelCalibEnded'));
                    _self.removeClass('calibrating');
                    $('#accel_calib_running').hide();
                    $('#accel_calib_rest').show();
                }, 2000);
            }
        });

        $('a.calibrateMag').click(function () {
            const _self = $(this);

            if (!_self.hasClass('calibrating') && !_self.hasClass('disabled')) {
                _self.addClass('calibrating');

                MSP.send_message(MSPCodes.MSP_MAG_CALIBRATION, false, false, function () {
                    GUI.log(i18n.getMessage('initialSetupMagCalibStarted'));
                    $('#mag_calib_running').show();
                    $('#mag_calib_rest').hide();
                });

                GUI.timeout_add('button_reset', function () {
                    GUI.log(i18n.getMessage('initialSetupMagCalibEnded'));
                    _self.removeClass('calibrating');
                    $('#mag_calib_running').hide();
                    $('#mag_calib_rest').show();
                }, 30000);
            }
        });

        const dialogConfirmReset = $('.dialogConfirmReset')[0];

        $('a.resetSettings').click(function () {
            dialogConfirmReset.showModal();
        });

        $('a.clockwise').click(function () {
            MSP.send_message(MSPCodes.MSP_SET_MOTOR, [1], false, function () {

            });
        });
        $('a.anti_clockwise').click(function () {
            MSP.send_message(MSPCodes.MSP_SET_MOTOR, [2], false, function () {

            });
        });
        $('a.stop').click(function () {
            MSP.send_message(MSPCodes.MSP_SET_MOTOR, [0], false, function () {

            });
        });

        $('a.spray').click(function () {
            MSP.send_message(MSPCodes.MSP_SET_SPRAY, [1], false, false);
        });

        $('#sliderGyroFilterMultiplier').val(0);
        $('#sliderGyroFilterMultiplier').on('input', function () {
            const val = $(this).val();
            MSP.send_message(MSPCodes.MSP_SET_FAN, [val], false, function () {

            });
        });
        $('div.permanentExpertMode input').prop('checked', false);
        $('div.permanentExpertMode input').change(function () {
            const checked = $(this).is(':checked');
            //console.log("checked:" + checked)
            if(checked) {
                MSP.send_message(MSPCodes.MSP_SET_FAN, [100], false, function () {

                });
            } else {
                MSP.send_message(MSPCodes.MSP_SET_FAN, [0], false, function () {

                });
            }
        });
        $('.dialogConfirmReset-cancelbtn').click(function() {
            dialogConfirmReset.close();
        });

        $('.dialogConfirmReset-confirmbtn').click(function() {
            dialogConfirmReset.close();
            MSP.send_message(MSPCodes.MSP_RESET_CONF, false, false, function () {
                GUI.log(i18n.getMessage('initialSetupSettingsRestored'));

                GUI.tab_switch_cleanup(function () {
                    TABS.setup.initialize();
                });
            });
        });

        // display current yaw fix value (important during tab re-initialization)
        $('div#interactive_block > a.reset').text(i18n.getMessage('initialSetupButtonResetZaxisValue', [self.yaw_fix]));

        // reset yaw button hook
        $('div#interactive_block > a.reset').click(function () {
            self.yaw_fix = FC.SENSOR_DATA.kinematics[2] * - 1.0;
            $(this).text(i18n.getMessage('initialSetupButtonResetZaxisValue', [self.yaw_fix]));

            console.log(`YAW reset to 0 deg, fix: ${self.yaw_fix} deg`);
        });

        backupButton.click(function () {
            if ($(this).hasClass('disabled')) {
                return;
            }

            configuration_backup(function () {
                GUI.log(i18n.getMessage('initialSetupBackupSuccess'));
            });
        });

        $('#content .restore').click(function () {
            if ($(this).hasClass('disabled')) {
                return;
            }

            configuration_restore(function () {
                // get latest settings
                TABS.setup.initialize();

                GUI.log(i18n.getMessage('initialSetupRestoreSuccess'));
            });
        });

        // cached elements
        const left_adc_e = $('.leftAdc'),
            right_adc_e = $('.rightAdc'),
            fan_adc_e = $('.fanAdc'),
            atti_yaw_e = $('.attiYaw'),
            gyro_x_e = $('.gyroXData'),
            gyro_y_e = $('.gyroYData'),
            gyro_z_e = $('.gyroZData'),
            acc_x_e = $('.accXData'),
            acc_y_e = $('.accYData'),
            acc_z_e = $('.accZData'),
            arming_disable_flags_e = $('.arming-disable-flags');

        if (semver.lt(FC.CONFIG.apiVersion, API_VERSION_1_36)) {
            arming_disable_flags_e.hide();
        }

        const calcFc = function(arr) {
            var sum=0;
            var s=0;
            for(var i=0;i<arr.length;i++){
                sum+=arr[i];
            }
            let ave=sum/arr.length;
            for(var j=0;j<arr.length;j++){
                s+=Math.pow((ave-arr[j]),2);
            }
            return Math.sqrt((s/arr.length),2);
        };


        // DISARM FLAGS
        // We add all the arming/disarming flags available, and show/hide them if needed.
        const prepareDisarmFlags = function() {

            let disarmFlagElements = [
                'NO_GYRO',
                'FAILSAFE',
                'RX_FAILSAFE',
                'BAD_RX_RECOVERY',
                'BOXFAILSAFE',
                'THROTTLE',
                'ANGLE',
                'BOOT_GRACE_TIME',
                'NOPREARM',
                'LOAD',
                'CALIBRATING',
                'CLI',
                'CMS_MENU',
                'OSD_MENU',
                'BST',
                'MSP',
            ];

            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_38)) {
                disarmFlagElements.splice(disarmFlagElements.indexOf('THROTTLE'), 0, 'RUNAWAY_TAKEOFF');
            }

            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_39)) {
                disarmFlagElements = disarmFlagElements.concat(['PARALYZE',
                                                                'GPS']);
            }

            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_41)) {
                disarmFlagElements.splice(disarmFlagElements.indexOf('OSD_MENU'), 1);
                disarmFlagElements = disarmFlagElements.concat(['RESC']);
                disarmFlagElements = disarmFlagElements.concat(['RPMFILTER']);
            }
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                disarmFlagElements.splice(disarmFlagElements.indexOf('THROTTLE'), 0, 'CRASH');
                disarmFlagElements = disarmFlagElements.concat(['REBOOT_REQD',
                                                                'DSHOT_BBANG']);
            }
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
                disarmFlagElements = disarmFlagElements.concat(['NO_ACC_CAL', 'MOTOR_PROTO']);
            }

            // Always the latest element
            disarmFlagElements = disarmFlagElements.concat(['ARM_SWITCH']);

            // Arming allowed flag
            arming_disable_flags_e.append('<span id="initialSetupArmingAllowed" i18n="initialSetupArmingAllowed" style="display: none;"></span>');

            // Arming disabled flags
            for (let i = 0; i < FC.CONFIG.armingDisableCount; i++) {

                // All the known elements but the ARM_SWITCH (it must be always the last element)
                if (i < disarmFlagElements.length - 1) {
                    arming_disable_flags_e.append('<span id="initialSetupArmingDisableFlags' + i + '" class="cf_tip disarm-flag" title="' + i18n.getMessage('initialSetupArmingDisableFlagsTooltip' + disarmFlagElements[i]) + '" style="display: none;">' + disarmFlagElements[i] + '</span>');

                // The ARM_SWITCH, always the last element
                } else if (i == FC.CONFIG.armingDisableCount - 1) {
                    arming_disable_flags_e.append('<span id="initialSetupArmingDisableFlags' + i + '" class="cf_tip disarm-flag" title="' + i18n.getMessage('initialSetupArmingDisableFlagsTooltipARM_SWITCH') + '" style="display: none;">ARM_SWITCH</span>');

                // Unknown disarm flags
                } else {
                    arming_disable_flags_e.append('<span id="initialSetupArmingDisableFlags' + i + '" class="disarm-flag" style="display: none;">' + (i + 1) + '</span>');
                }
            }
        };

        prepareDisarmFlags();

        function get_slow_data() {

        }

        function get_fast_data() {
            console.log("update fast data");

            const tb = $('.cf_table tbody');//[0].style.background = "yellow";
            const rows = tb.find("tr");

            MSP.send_message(MSPCodes.MSP_ANALOG, false, false, function () {
                if(FC.ANALOG.leftMotorAdc < 2000) {
                    rows[0].style.background = "red";
                } else {
                    rows[0].style.background = "green";
                }


                left_adc_e.text(i18n.getMessage('leftMotorCurrentValue', [FC.ANALOG.leftMotorAdc]));
                if(FC.ANALOG.rightMotorAdc < 2000) {
                    rows[1].style.background = "red";
                } else {
                    rows[1].style.background = "green";
                }

                right_adc_e.text(i18n.getMessage('rightMotorCurrentValue', [FC.ANALOG.rightMotorAdc]));
                if(FC.ANALOG.fanAdc < 1000) {
                    rows[2].style.background = "red";
                } else {
                    rows[2].style.background = "green";
                }
                fan_adc_e.text(i18n.getMessage('fanAdcValue', [FC.ANALOG.fanAdc]));
            });

            MSP.send_message(MSPCodes.MSP_ATTITUDE, false, false, function () {
                rows[3].style.background = "green";
                atti_yaw_e.text(i18n.getMessage('attiYawValue', [FC.SENSOR_DATA.kinematics[0]]));
            });

            MSP.send_message(MSPCodes.MSP_RAW_IMU, false, false, function () {

                if(updateGyroData(FC.SENSOR_DATA.gyroscope[0],FC.SENSOR_DATA.gyroscope[1],FC.SENSOR_DATA.gyroscope[2])) {
                    let fcgx = calcFc(gyroX);
                    let fcgy = calcFc(gyroY);
                    let fcgz = calcFc(gyroZ);

                    if(fcgx == 0 || FC.SENSOR_DATA.gyroscope[0] > 20) {
                        rows[4].style.background = "red";
                    } else {
                        rows[4].style.background = "green";
                    }

                    if(fcgy == 0 || FC.SENSOR_DATA.gyroscope[1] > 20) {
                        rows[5].style.background = "red";
                    } else {
                        rows[5].style.background = "green";
                    }
                    if(fcgz == 0 || FC.SENSOR_DATA.gyroscope[2] > 20) {
                        rows[6].style.background = "red";
                    } else {
                        rows[6].style.background = "green";
                    }
                }

                if(updateAccData(FC.SENSOR_DATA.accelerometer[0],FC.SENSOR_DATA.accelerometer[1],FC.SENSOR_DATA.accelerometer[2])) {
                    let fcax = calcFc(accX);
                    let fcay = calcFc(accY);
                    let fcaz = calcFc(accZ);

                    if(fcax == 0 || FC.SENSOR_DATA.accelerometer[0] > 300) {
                        rows[7].style.background = "red";
                    } else {
                        rows[7].style.background = "green";
                    }

                    if(fcay == 0 || FC.SENSOR_DATA.accelerometer[1] > 300) {
                        rows[8].style.background = "red";
                    } else {
                        rows[8].style.background = "green";
                    }
                    if(fcaz == 0 || FC.SENSOR_DATA.accelerometer[2] <  300) {
                        rows[9].style.background = "red";
                    } else {
                        rows[9].style.background = "green";
                    }
                }

                gyro_x_e.text(i18n.getMessage('gyroXValue', [FC.SENSOR_DATA.gyroscope[0]]));
                gyro_y_e.text(i18n.getMessage('gyroYValue', [FC.SENSOR_DATA.gyroscope[1]]));
                gyro_z_e.text(i18n.getMessage('gyroZValue', [FC.SENSOR_DATA.gyroscope[2]]));

                acc_x_e.text(i18n.getMessage('accXValue', [FC.SENSOR_DATA.accelerometer[0]]));
                acc_y_e.text(i18n.getMessage('accYValue', [FC.SENSOR_DATA.accelerometer[1]]));
                acc_z_e.text(i18n.getMessage('accZValue', [FC.SENSOR_DATA.accelerometer[2]]));
            });

        }

        GUI.interval_add('setup_data_pull_fast', get_fast_data, 33, true); // 30 fps
        //GUI.interval_add('setup_data_pull_slow', get_slow_data, 250, true); // 4 fps

        GUI.content_ready(callback);
    }
};

TABS.setup.initializeInstruments = function() {
    const options = {size:90, showBox : false, img_directory: 'images/flightindicators/'};
    const attitude = $.flightIndicator('#attitude', 'attitude', options);
    const heading = $.flightIndicator('#heading', 'heading', options);

    this.updateInstruments = function() {
        attitude.setRoll(FC.SENSOR_DATA.kinematics[0]);
        attitude.setPitch(FC.SENSOR_DATA.kinematics[1]);
        heading.setHeading(FC.SENSOR_DATA.kinematics[2]);
    };
};

TABS.setup.initModel = function () {
    this.model = new Model($('.model-and-info #canvas_wrapper'), $('.model-and-info #canvas'));

    $(window).on('resize', $.proxy(this.model.resize, this.model));
};

TABS.setup.renderModel = function () {
    const x = (FC.SENSOR_DATA.kinematics[1] * -1.0) * 0.017453292519943295,
        y = ((FC.SENSOR_DATA.kinematics[2] * -1.0) - this.yaw_fix) * 0.017453292519943295,
        z = (FC.SENSOR_DATA.kinematics[0] * -1.0) * 0.017453292519943295;

    this.model.rotateTo(x, y, z);
};

TABS.setup.cleanup = function (callback) {
    if (this.model) {
        $(window).off('resize', $.proxy(this.model.resize, this.model));
        this.model.dispose();
    }

    if (callback) callback();
};
