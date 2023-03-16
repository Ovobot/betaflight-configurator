'use strict';

const setup = {
    yaw_fix: 0.0,
    sampleCnt:0,
    sampleAccCnt:0,
    bufLen:30,
    sampleWheel:0,
    sampleFan:0,
    adcBufLen:20,
};

setup.initialize = function (callback) {
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
        if(FC.CONFIG.hw == 3) {
            $('#content').load("./tabs/ecs_setup.html", process_html);
        } else if(FC.CONFIG.hw == 2) {
            $('#content').load("./tabs/ecs_setup.html", process_html);
            //$('#content').load("./tabs/esl_setup.html", process_html);
        } else {
            $('#content').load("./tabs/setup.html", process_html);
        }
    }

    function bitIsZero(x, bitIndex) {
        return (((x >> bitIndex) & 1) == 1) ? false : true
    }

    //MSP.send_message(MSPCodes.MSP_ACC_TRIM, false, false, load_status);
    load_html();

    let gyroX = Array.from({length: self.bufLen});
    let gyroY = Array.from({length: self.bufLen});
    let gyroZ = Array.from({length: self.bufLen});

    let accX = Array.from({length: self.bufLen});
    let accY = Array.from({length: self.bufLen});
    let accZ = Array.from({length: self.bufLen});

    let leftWheelAdcBuf = Array.from({length: self.adcBufLen});
    let rightWheelAdcBuf = Array.from({length: self.adcBufLen});
    let fanAdcBuf = Array.from({length: self.adcBufLen});


    let testZ = [1,1,1,1,1,1,1,0,1,1,1,1,1,1,1];

    let fanOpened = false;
    let fanCheckEnd = false;
    let selfCheckFinished = false;
    let gyrovalideCnt = 0;
    let selfCheckState = 0;
    let wheelState = -1;//
    let wheelfront = true;
    let wheelCheckEnd = false;
    let leftWheelError = false;
    let rightWheelError = false;
    let wheelChangeDelay = 0;//发送命令到执行有时间间隔
    const WHEELCHECKDELAY = 2;
    let fanError = false;
    let fanChangeDelay = 0;
    const FANCHECKDELAY = 20;
    let battError = false;
    let adapterError = false;
    let baroError = false;
    let waitFourCornerClose = false;
    let leftIdleAdc = 0;
    let rightIdleAdc = 0;
    let fanIdleAdc = 0;
    let gyroErrorHappend = false;
    let autoTestReady = true;
    function selfCheckTask() {
        if (selfCheckState == 0) {
            //检测陀螺仪
            gyrovalideCnt = 0;
            selfCheckState = 1;
        }
    }

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

    function updateWheelData(val1,val2) {
        for (let i = 0; i < self.adcBufLen - 1; i++) {
            leftWheelAdcBuf[i] = leftWheelAdcBuf[i + 1];
            rightWheelAdcBuf[i] = rightWheelAdcBuf[i + 1];
        }
        leftWheelAdcBuf[self.adcBufLen - 1] = val1;
        rightWheelAdcBuf[self.adcBufLen - 1] = val2;
        if(self.sampleWheel > self.adcBufLen) {
            return 1;
        } else {
            self.sampleWheel++;
            return 0;
        }
    }

    function updateFanData(val) {
        for (let i = 0; i < self.adcBufLen - 1; i++) {
            fanAdcBuf[i] = fanAdcBuf[i + 1];
        }
        fanAdcBuf[self.adcBufLen - 1] = val;
        if(self.sampleFan > self.adcBufLen) {
            return 1;
        } else {
            self.sampleFan++;
            return 0;
        }
    }

    function showErrorDialog(message) {
        const dialog = $('.dialogError')[0];
     
         $('.dialogError-content').html(message);
     
         $('.dialogError-closebtn').click(function() {
             dialog.close();
         });
     
         dialog.showModal();
    }


    function showSprayResultDialog() {
        const dialog = $('.dialogSprayConfirm')[0];
         
        $('.dialogSprayConfirm-confirmbtn').click(function() {
           autoTestReady = false; 
           dialog.close();
        });
        $('.dialogSprayConfirm-cancelbtn').click(function() {
            autoTestReady = false;
            dialog.close();
         });
        dialog.showModal();       
    }

    function showSprayTestDialog(message) {
        const dialog = $('.dialogTestSpray')[0];
     
         $('.dialogTestSpray-content').html(message);
     
         $('.dialogTestSpray-spraybtn').click(function() {
            MSP.send_message(MSPCodes.MSP_SET_SPRAY, [1], false, false);
            dialog.close();
            showSprayResultDialog();
         });

         $('.dialogTestSpray-closebtn').click(function() {
            dialog.close();
         });
     
         dialog.showModal();
    }

    function closeAutoTestDialog()
    {
        const dialog = $('.dialogAutoTest')[0];    
        dialog.close();
    }

    function showAutoTestDialogTitle(title) {
        const dialog = $('.dialogAutoTest')[0];  
        $('.dialogAutoTestTitle').html(title);
        dialog.showModal();
    }

    function changeAutoTestDialogTitle(title) {
        $('.dialogAutoTestTitle').html(title);
    }

    function showFourCornerDialog(message) {
        const dialog = $('.dialogTestFourCorner')[0];
        $('.dialogTestFourCornerTitle').html(message);
        $('.dialogTestFourCorner-closebtn').click(function() {
            closeAutoTestDialog();
            selfCheckState = 0;
            self.sampleCnt = 0;
            self.sampleAccCnt = 0;
            dialog.close();
        });
        dialog.showModal();
    }

    function dismissFourCornerDialog() {
        const dialog = $('.dialogTestFourCorner')[0];
        dialog.close();
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
        const dialogAutoTestWait = $('.dialogAutoTest')[0];    
        $('.dialogAutoTest-closebtn').click(function() {
            selfCheckState = 0;
            self.sampleCnt = 0;
            self.sampleAccCnt = 0;
            dialogAutoTestWait.close();
        });
        const dialogTestFourCorner = $('.dialogTestFourCorner')[0];
        
        $('a.autoTestPCB').click(function () {
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
        $('a.nextVoice').click(function () {
            MSP.send_message(MSPCodes.MSP_PLAY_VOICE, [1], false, function () {

            });
        });
        $('a.preVoice').click(function () {
            MSP.send_message(MSPCodes.MSP_PLAY_VOICE, [0], false, function () {

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
                MSP.send_message(MSPCodes.MSP_SET_FAN, [60], false, function () {
                    fanOpened = true;
                });
            } else {
                MSP.send_message(MSPCodes.MSP_SET_FAN, [0], false, function () {
                    fanOpened = false;
                });
            }
        });
        $('.dialogConfirmReset-cancelbtn').click(function() {
            dialogConfirmReset.close();
        });
        //开始自动化测试    
        $('.dialogConfirmReset-confirmbtn').click(function() {
            autoTestReady = true;
            dialogConfirmReset.close();
            selfCheckState = 0;
            self.sampleCnt = 0;
            self.sampleAccCnt = 0;
            fanOpened = false;
            selfCheckTask();
            //dialogAutoTestWait.showModal();
            showAutoTestDialogTitle(i18n.getMessage('dialogAutoTestGyroAccTitle'));
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
            batt_adc_e = $('.battAdc'),
            adapter_adc_e = $('.adapterAdc'),
            waterstate_e = $('.waterboxAdc'),
            atti_yaw_e = $('.attiYaw'),
            baro_val_e = $('.baroVal'),
            corner_ul_e = $('.cornerULVal'),
            corner_ur_e = $('.cornerURVal'),
            corner_bl_e = $('.cornerBLVal'),
            corner_br_e = $('.cornerBRVal'),
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

        const calcAverage = function(arr) {
            var sum=0;
            var s=0;
            for(var i=0;i<arr.length;i++){
                sum+=arr[i];
            }
            let ave=sum/arr.length;
            return ave;
            // for(var j=0;j<arr.length;j++){
            //     s+=Math.pow((ave-arr[j]),2);
            // }
            // return Math.sqrt((s/arr.length),2);
        };

        const elementAllSame = function(arr) {
            var sum=0;
            var fl= arr[0];
            for(var i=1;i<arr.length;i++){
                if (fl == arr[i]) {
                    sum += 1;
                }
                fl = arr[i];
            }
            if (sum == arr.length - 1) {
                return true;
            }
            return false;
        };

        const gyrostring = function(arr) {
            var gstr = ""
            for(var i=0;i<arr.length;i++){
                gstr += arr[i];
                gstr += ","
            }
            return gstr;
        }

        // if (elementAllSame(testZ)) {
        //     dialogAutoTestWait.showModal();
        // } else {
        //     showErrorDialog("元素不都一样");
        // }
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
            const tb = $('.cf_table tbody');
            const rows = tb.find("tr");
            if(FC.CONFIG.hw == 2) {
                MSP.send_message(MSPCodes.MSP_BATTERY, false, false, function () {
                    batt_adc_e.text(i18n.getMessage('battAdcValue', [FC.ANALOG.batt]));
                    if (FC.ANALOG.batt >= 12 && FC.ANALOG.batt <= 18) {
                        battError = false;
                        rows[3].style.background = "green";
                    } else {
                        battError = true;
                        rows[3].style.background = "red";
                    }
                    if (selfCheckState == 3) {
                        if (battError) {
                            selfCheckState = 0;
                            dialogAutoTestWait.close();
                            showErrorDialog(battError);
                        } else {
                            selfCheckState = 4;
                        }
                    }
                });
            }

            MSP.send_message(MSPCodes.MSP_ATTITUDE, false, false, function () {
                rows[6].style.background = "green";
                atti_yaw_e.text(i18n.getMessage('attiYawValue', [FC.SENSOR_DATA.kinematics[0]]));
            });

            MSP.send_message(MSPCodes.MSP_ADAPTER, false, false, function () {
                adapter_adc_e.text(i18n.getMessage('adapterValue', [FC.ANALOG.adapter]));
                if (FC.ANALOG.adapter >= 22 && FC.ANALOG.adapter <= 26) {
                    adapterError = false;
                    rows[4].style.background = "green";
                } else {
                    adapterError = true;
                    rows[4].style.background = "red";
                }  
                if (selfCheckState == 4) {
                    if (adapterError) {
                        selfCheckState = 0;
                        dialogAutoTestWait.close();
                        showErrorDialog(adapterError);
                    } else {
                        if(FC.CONFIG.hw == 3) {
                            selfCheckState = 6;
                            //检测马达
                            wheelState = 0;
                            wheelChangeDelay = WHEELCHECKDELAY;
                            leftWheelError = false;
                            rightWheelError = false;
                            self.sampleWheel = 0;
                            wheelCheckEnd = false;

                            fanChangeDelay = FANCHECKDELAY;
                            self.sampleFan = 0;
                            fanCheckEnd = false;
                            fanError = false;
                        } else if(FC.CONFIG.hw == 2) {
                            selfCheckState = 5;
                        }
                        
                    }
                }
                  
            });

            MSP.send_message(MSPCodes.MSP_WATER_BOX, false, false, function () {
                waterstate_e.text(i18n.getMessage('waterStateValue', [FC.ANALOG.waterstate]));
                rows[5].style.background = "green";                
            });

            MSP.send_message(MSPCodes.MSP_FOURCORNER, false, false, function () {
                const ul_data = bitIsZero(FC.ANALOG.corner,3) ? 0 : 1 
                const ur_data = bitIsZero(FC.ANALOG.corner,2) ? 0 : 1 
                const bl_data = bitIsZero(FC.ANALOG.corner,1) ? 0 : 1 
                const br_data = bitIsZero(FC.ANALOG.corner,0) ? 0 : 1 

                corner_ul_e.text(i18n.getMessage('cornerValue', [ul_data]));
                corner_ur_e.text(i18n.getMessage('cornerValue', [ur_data]));
                corner_bl_e.text(i18n.getMessage('cornerValue', [bl_data]));
                corner_br_e.text(i18n.getMessage('cornerValue', [br_data]));

                if(ul_data ==  0) {
                    rows[8].style.background = "red";
                } else {
                    rows[8].style.background = "green";
                }
                if(ur_data ==  0) {
                    rows[9].style.background = "red";
                } else {
                    rows[9].style.background = "green";
                }
                if(bl_data ==  0) {
                    rows[10].style.background = "red";
                } else {
                    rows[10].style.background = "green";
                }
                if(br_data ==  0) {
                    rows[11].style.background = "red";
                } else {
                    rows[11].style.background = "green";
                }
                if (selfCheckState == 8) {
                    if (waitFourCornerClose) {
                        if (FC.ANALOG.corner == 0x00) {
                            selfCheckState = 9;
                            dialogAutoTestWait.close();
                            dismissFourCornerDialog();
                            showSprayTestDialog(i18n.getMessage('dialogTestSprayNotice'));
                            //showFourCornerDialog(i18n.getMessage('dialogAutoTestSuccessTitle'));
                        }
                    } else {
                        if (FC.ANALOG.corner == 0x0f) {
                            selfCheckState = 9;
                            dialogAutoTestWait.close();
                            dismissFourCornerDialog();
                            showSprayTestDialog(i18n.getMessage('dialogTestSprayNotice'));
                            //showFourCornerDialog(i18n.getMessage('dialogAutoTestSuccessTitle'));
                        }
                    }
                }
            });

        }

        function get_fast_data() {
            //console.log("update fast data");

            const tb = $('.cf_table tbody');
            const rows = tb.find("tr");
            if (!autoTestReady) return;    
            
            MSP.send_message(MSPCodes.MSP_ANALOG, false, false, function () {
                left_adc_e.text(i18n.getMessage('leftMotorCurrentValue', [FC.ANALOG.leftMotorAdc]));
                right_adc_e.text(i18n.getMessage('rightMotorCurrentValue', [FC.ANALOG.rightMotorAdc]));
                fan_adc_e.text(i18n.getMessage('fanAdcValue', [FC.ANALOG.fanAdc]));
                if(FC.ANALOG.leftMotorAdc < 3100 && FC.ANALOG.leftMotorAdc > 2500) {
                    rows[0].style.background = "green";
                } else {
                    rows[0].style.background = "red";
                }

                if(FC.ANALOG.rightMotorAdc < 3100 && FC.ANALOG.rightMotorAdc > 2500) {
                    rows[1].style.background = "green";
                } else {
                    rows[1].style.background = "red";
                }


                if(FC.CONFIG.hw == 1) {
                    if(!fanOpened) {
                        if(FC.ANALOG.fanAdc < 100) {
                            rows[2].style.background = "green";
                        } else {
                            rows[2].style.background = "red";
                        }
                    } else {
                        if(FC.ANALOG.fanAdc > 500) {
                            rows[2].style.background = "green";
                        } else {
                            rows[2].style.background = "red";
                        }
                    }
                } else {
                    if(FC.ANALOG.fanAdc < 3100 && FC.ANALOG.fanAdc > 2500) {
                        rows[2].style.background = "green";
                    } else {
                        rows[2].style.background = "red";
                    }
                }
                if (selfCheckState == 6) {
                    //马达静止
                    if (wheelState == 0) {
                        if (wheelChangeDelay >= WHEELCHECKDELAY) {
                            if (updateWheelData(FC.ANALOG.leftMotorAdc,FC.ANALOG.rightMotorAdc)) {
                                leftIdleAdc = calcAverage(leftWheelAdcBuf);
                                rightIdleAdc = calcAverage(rightWheelAdcBuf);

                                if(FC.CONFIG.hw == 1) {
                                    if(!fanOpened) {
                                        if(FC.ANALOG.fanAdc < 100) {
                                            rows[2].style.background = "green";
                                        } else {
                                            rows[2].style.background = "red";
                                        }
                                    } else {
                                        if(FC.ANALOG.fanAdc > 500) {
                                            rows[2].style.background = "green";
                                        } else {
                                            rows[2].style.background = "red";
                                        }
                                    }
                                } 
                                let errorWheelString = ''
                                if (leftWheelError) {
                                    errorWheelString += i18n.getMessage('leftWheelError');
                                } 
                                if (rightWheelError) {
                                    errorWheelString += " "
                                    errorWheelString += i18n.getMessage('rightWheelError');
                                } 
                                if (errorWheelString.length > 0) {
                                    selfCheckState = 0;
                                    wheelState = -1;
                                    dialogAutoTestWait.close();
                                    showErrorDialog(errorWheelString);
                                } else {
                                    //dialogAutoTestWait.close();
                                    //showErrorDialog("一切正常");
                                    wheelState = 1;
                                    wheelChangeDelay = 0;
                                    //正转马达
                                    if (wheelfront) {
                                        MSP.send_message(MSPCodes.MSP_SET_MOTOR, [1], false, function () {
                                            wheelChangeDelay = 1;
                                        });
                                    } else {
                                        MSP.send_message(MSPCodes.MSP_SET_MOTOR, [2], false, function () {
                                            wheelChangeDelay = 1;
                                        });
                                    }    
                                }
                            }
                        } else {
                            self.sampleWheel = 0;
                            wheelChangeDelay++;
                        }
                        
                    } else if (wheelState == 1) {
                        if (wheelChangeDelay >= WHEELCHECKDELAY) {
                            if (updateWheelData(FC.ANALOG.leftMotorAdc,FC.ANALOG.rightMotorAdc)) {
                                let leftAverageNum = calcAverage(leftWheelAdcBuf);
                                let rightAverageNum = calcAverage(rightWheelAdcBuf);
                                let diffLeft = leftIdleAdc - leftAverageNum;
                                let diffRight = rightIdleAdc - rightAverageNum;

                                if (diffLeft >= 5 && diffLeft <= 40) {
                                    leftWheelError = false;
                                } else {
                                    leftWheelError = true;
                                }
                                
                                if(diffRight >= 5 && diffRight <= 40) {
                                    rightWheelError = false;
                                } else {
                                    rightWheelError = true;
                                }
                
                                if(FC.CONFIG.hw == 1) {
                                    if(!fanOpened) {
                                        if(FC.ANALOG.fanAdc < 100) {
                                            rows[2].style.background = "green";
                                        } else {
                                            rows[2].style.background = "red";
                                        }
                                    } else {
                                        if(FC.ANALOG.fanAdc > 500) {
                                            rows[2].style.background = "green";
                                        } else {
                                            rows[2].style.background = "red";
                                        }
                                    }
                                }
                                let errorWheelString = ''
                                if (leftWheelError) {
                                    errorWheelString += (i18n.getMessage('leftWheelError') + FC.ANALOG.leftMotorAdc);
                                } 
                                if (rightWheelError) {
                                    errorWheelString += " "
                                    errorWheelString += (i18n.getMessage('rightWheelError') + FC.ANALOG.rightMotorAdc);
                                } 
                                if (errorWheelString.length > 0) {
                                    selfCheckState = 0;
                                    wheelState = -1;
                                    dialogAutoTestWait.close();
                                    showErrorDialog(errorWheelString);
                                    MSP.send_message(MSPCodes.MSP_SET_MOTOR, [0], false, function () {
                                        
                                    });
                                } else {
                                    if (!wheelfront) {
                                        wheelState = -1;
                                        wheelCheckEnd = true;
                                        // fanChangeDelay = FANCHECKDELAY;
                                        // self.sampleFan = 0;
                                        // selfCheckState = 7;//检测风机
                                        // fanCheckEnd = false;
                                        // changeAutoTestDialogTitle(i18n.getMessage("dialogAutoTestFanTitle"));
                                        if (fanCheckEnd) {
                                            selfCheckState = 8;//
                                            if (FC.ANALOG.corner == 0x0f) {
                                                waitFourCornerClose = true;
                                                showFourCornerDialog(i18n.getMessage('dialogTestFourCornerOpenTitle'));
                                            } else if (FC.ANALOG.corner == 0x00) {
                                                waitFourCornerClose = false;
                                                showFourCornerDialog(i18n.getMessage('dialogTestFourCornerCloseTitle'));
                                            } else {
                                                selfCheckState = 0;
                                                dialogAutoTestWait.close();
                                                showErrorDialog(i18n.getMessage('fourCornerError'));
                                            }
                                        }
                                    } else {
                                        wheelState = 0;
                                    }
                                    wheelfront = !wheelfront;
                                    wheelChangeDelay = 0;
                                    MSP.send_message(MSPCodes.MSP_SET_MOTOR, [0], false, function () {
                                        
                                    });
                                }
                            }
                        } else {
                            self.sampleWheel = 0;
                            wheelChangeDelay += 1;
                        }
                        
                    }

                    if (fanChangeDelay >= FANCHECKDELAY) {
                        if (updateFanData(FC.ANALOG.fanAdc)) {
                            if (!fanOpened) {
                                fanIdleAdc = calcAverage(fanAdcBuf);

                                if (fanError) {
                                    selfCheckState = 0;
                                    dialogAutoTestWait.close();
                                    showErrorDialog(i18n.getMessage('fanError'));
                                } else {

                                    if (fanCheckEnd) {
                                        fanChangeDelay = 0;
                                    } else {
                                        MSP.send_message(MSPCodes.MSP_SET_FAN, [60], false, function () {
                                            fanChangeDelay = 0;
                                            fanOpened = true;
                                        });
                                    }
                                    
                                }
                            } else {
                                let fanOpenAdc = calcAverage(fanAdcBuf);
                                let diffFan = fanIdleAdc - fanOpenAdc;
                                if(diffFan >= 50 && diffFan <= 200) {
                                    fanError = false;
                                } else {
                                    fanError = true;
                                }
                
                                if (fanError) {
                                    selfCheckState = 0;
                                    dialogAutoTestWait.close();
                                    showErrorDialog(i18n.getMessage('fanError') + diffFan);
                                    MSP.send_message(MSPCodes.MSP_SET_FAN, [0], false, function () {
                                        fanOpened = false;
                                    });
                                } else {
                                    fanChangeDelay = 0;
                                    fanCheckEnd = true;

                                    MSP.send_message(MSPCodes.MSP_SET_FAN, [0], false, function () {
                                        fanOpened = false;
                                        if (wheelCheckEnd) {
                                            selfCheckState = 8;//
                                            if (FC.ANALOG.corner == 0x0f) {
                                                waitFourCornerClose = true;
                                                showFourCornerDialog(i18n.getMessage('dialogTestFourCornerOpenTitle'));
                                            } else if (FC.ANALOG.corner == 0x00) {
                                                waitFourCornerClose = false;
                                                showFourCornerDialog(i18n.getMessage('dialogTestFourCornerCloseTitle'));
                                            } else {
                                                selfCheckState = 0;
                                                dialogAutoTestWait.close();
                                                showErrorDialog(i18n.getMessage('fourCornerError'));
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    } else {
                        self.sampleFan = 0;
                        fanChangeDelay++;
                    }
                } else if (selfCheckState == 7) {
                    
                }
            });
            
            if(FC.CONFIG.hw == 2) {
                MSP.send_message(MSPCodes.MSP_BARO, false, false, function () {
                    baro_val_e.text(i18n.getMessage('baroValue', [FC.SENSOR_DATA.baro]));
                    if (FC.SENSOR_DATA.baro >= 100000 && FC.SENSOR_DATA.baro <= 120000) {
                        rows[6].style.background = "green";
                        baroError = false;
                    } else {
                        rows[6].style.background = "red";
                        baroError = true;
                    }
                    if (selfCheckState == 5) {
                        if (baroError) {
                            selfCheckState = 0;
                            dialogAutoTestWait.close();
                            showErrorDialog(i18n.getMessage('baroError'));
                        } else {
                            selfCheckState = 6;
                            //检测马达
                            wheelState = 0;
                            wheelChangeDelay = 0;
                        }
                    }   
                    
                });
            }


            MSP.send_message(MSPCodes.MSP_RAW_IMU, false, false, function () {

                if(updateGyroData(FC.SENSOR_DATA.gyroscope[0],FC.SENSOR_DATA.gyroscope[1],FC.SENSOR_DATA.gyroscope[2])) {                    
                    if(elementAllSame(gyroX) || FC.SENSOR_DATA.gyroscope[0] > 20 || FC.SENSOR_DATA.gyroscope[0] < -20) {
                        rows[12].style.background = "red";
                    } else {
                        rows[12].style.background = "green";
                        if (selfCheckState == 1) {
                            gyrovalideCnt += 1;
                        }
                    }

                    if(elementAllSame(gyroY) || FC.SENSOR_DATA.gyroscope[1] > 20 || FC.SENSOR_DATA.gyroscope[1] < -20) {
                        rows[13].style.background = "red";
                    } else {
                        rows[13].style.background = "green";
                        if (selfCheckState == 1) {
                            gyrovalideCnt += 1;
                        }
                    }
                    if(elementAllSame(gyroZ) || FC.SENSOR_DATA.gyroscope[2] > 20 || FC.SENSOR_DATA.gyroscope[2] < -20) {
                        rows[14].style.background = "red";
                    } else {
                        rows[14].style.background = "green";
                        if (selfCheckState == 1) {
                            gyrovalideCnt += 1;
                        }
                    }
                    if (selfCheckState == 1) {
                        selfCheckState = 2;
                    }
                    
                }

                if(updateAccData(FC.SENSOR_DATA.accelerometer[0],FC.SENSOR_DATA.accelerometer[1],FC.SENSOR_DATA.accelerometer[2])) {
                    
                    if(elementAllSame(accX) || FC.SENSOR_DATA.accelerometer[0] > 300 || FC.SENSOR_DATA.accelerometer[0] < -300) {
                        rows[15].style.background = "red";
                    } else {
                        rows[15].style.background = "green";
                        if (selfCheckState == 2) {
                            gyrovalideCnt += 1;  
                        }
                    }

                    if(elementAllSame(accY) || FC.SENSOR_DATA.accelerometer[1] > 300 || FC.SENSOR_DATA.accelerometer[1] < -300) {
                        rows[16].style.background = "red";
                    } else {
                        rows[16].style.background = "green";
                        if (selfCheckState == 2) {
                            gyrovalideCnt += 1;  
                        }
                    }
                    if(elementAllSame(accZ) || FC.SENSOR_DATA.accelerometer[2] < 3797 || FC.SENSOR_DATA.accelerometer[2] > 4396)  {
                        rows[17].style.background = "red";
                    } else {
                        rows[17].style.background = "green";
                        if (selfCheckState == 2) {
                            gyrovalideCnt += 1;  
                        }
                    }
                    if (selfCheckState == 2) {
                        if (gyrovalideCnt == 6) {
                            if(FC.CONFIG.hw == 2) {
                                selfCheckState = 3;
                            } else if(FC.CONFIG.hw == 3) {
                                selfCheckState = 4;
                                changeAutoTestDialogTitle(i18n.getMessage("dialogAutoTestAdapterTitle"));
                                MSP.send_message(MSPCodes.MSP_ADAPTER, false, false, function () {
                                    if (FC.ANALOG.adapter >= 22 && FC.ANALOG.adapter <= 26) {
                                        adapterError = false;
                                    } else {
                                        adapterError = true;
                                    }  
                                    if (adapterError) {
                                        selfCheckState = 0;
                                        dialogAutoTestWait.close();
                                        showErrorDialog(adapterError);
                                    } else {
                                        changeAutoTestDialogTitle(i18n.getMessage("dialogAutoTestWheelTitle"));
                                        selfCheckState = 6;
                                        //检测马达
                                        wheelState = 0;
                                        wheelChangeDelay = WHEELCHECKDELAY;
                                        leftWheelError = false;
                                        rightWheelError = false;
                                        self.sampleWheel = 0;
                                        wheelCheckEnd = false;

                                        fanChangeDelay = FANCHECKDELAY;
                                        self.sampleFan = 0;
                                        fanCheckEnd = false;
                                        fanError = false;
                                    }
                                      
                                });
                            }
                            
                            //dialogTestFourCorner.showModal();
                        } else {
                            selfCheckState = 0;
                            dialogAutoTestWait.close();
                            showErrorDialog(i18n.getMessage('gyroError'));
                        } 
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

        GUI.interval_add('setup_data_pull_fast', get_fast_data, 50, true); // 30 fps
        GUI.interval_add('setup_data_pull_slow', get_slow_data, 250, true); // 4 fps

        GUI.content_ready(callback);
    }
};


setup.cleanup = function (callback) {
    if (this.model) {
        $(window).off('resize', $.proxy(this.model.resize, this.model));
        this.model.dispose();
    }

    if (callback) callback();
};

window.TABS.setup = setup;

export { setup };
