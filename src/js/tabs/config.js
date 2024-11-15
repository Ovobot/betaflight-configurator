import { i18n } from "../localization";

const config = {
};

config.initialize = function (callback) {

    if (GUI.active_tab != 'config') {
        GUI.active_tab = 'config';
        // Disabled on merge into betaflight-configurator
        //googleAnalytics.sendAppView('Setup OSD');
    }

    function load_status() {
        load_html();
    }

    function load_html() {
        $('#content').load("./tabs/config.html", process_html);
        // if (FC.CONFIG.hw == 3) {
        //     $('#content').load("./tabs/ecs_setup_config.html", process_html);
        // }else {
        //     $('#content').load("./tabs/setup.html", process_html);
        // }
    }

    load_status();

    function process_html() {

        const general_fan = $('#general-fan'),
            max_fan = $('#max-fan'),
            min_fan = $('#min-fan');
            // general_fan = $('#general-fan'),
            // general_fan = $('#general-fan'),
            // general_fan = $('#general-fan'),
            // general_fan = $('#general-fan'),

        // $('.tab-configuration .info').hide(); // requires an MSP update
        /*      Only used by get_slow_data() which is commented out.
                const osdVideoModes = new Set([
                    'AUTO',
                    'NTSC',
                    'PAL'
                ]);
        */
        // translate to user-selected language
        i18n.localizePage();
        // const dialogConfiguratorUpdate = $('.dialogConfiguratorUpdate')[0];
        // $('a.resetSettings').click(function () {
            // MSP.send_message(MSPCodes.MSP_RESET_CONF, false, false, function () {
            //     GUI.log(i18n.getMessage('initialSetupSettingsRestored'));

            //     GUI.tab_switch_cleanup(function () {
            //         TABS.configuration.initialize();
            //     });
            // });
        // });
        $('.model_fan .model_open_close').click(function () {
            $(this).toggleClass('rotate-90');
            $(".model_fan .grid-row-content").toggleClass('model-display');
        });
        $('#model-fan-btn .edit-fan').click(function () {
            $("#model-fan input").removeAttr("readonly");
            $(".grid-row-content input").removeClass('model-background');
            $('#model-fan-btn div a').removeClass('no-click');
        });
        $('#model-fan-btn .cancle-fan').click(function () {
            $("#model-fan input").prop('readonly', true);
            $(".grid-row-content input").addClass('model-background');
            $('#model-fan-btn .cancle-fan a').addClass('no-click');
            $('#model-fan-btn .save-fan a').addClass('no-click');

        });
        $('#model-fan-btn .save-fan').click(function () {
            $("#model-fan input").prop('readonly', true);
            $(".grid-row-content input").addClass('model-background');
            $('#model-fan-btn .cancle-fan a').addClass('no-click');
            $('#model-fan-btn .save-fan a').addClass('no-click');
        });

        // $('.model-fan-btn').click(function () {
        //     //弹窗
        //     dialogConfiguratorUpdate.showModal();
        // })

        function get_slow_data() {
            /* FIXME requires MSP update
            MSP.send_message(MSPCodes.MSP_OSD_VIDEO_STATUS, false, false, function () {
                let element element = $('.video-mode');
                const osdVideoMode = osdVideoModes[OSD_VIDEO_STATE.video_mode];
                element.text(osdVideoMode);

                element = $('.camera-connected');
                element.text(OSD_VIDEO_STATE.camera_connected ? i18n.getMessage('yes') : i18n.getMessage('No'));
            });
            */
            MSP.send_message(MSPCodes.MSP_GET_PWMVALUE, false, false, function () {
                // console.log("==========pwmvalue:" + [FC.OVOBOT_FUNCTION.pwmvalue]);
                general_fan.val(i18n.getMessage('pwmvalue', [FC.OVOBOT_FUNCTION.pwmvalue]));
                max_fan.val(i18n.getMessage('pwmvaluemax', [FC.OVOBOT_FUNCTION.pwmvaluemax]));
                min_fan.val(i18n.getMessage('pwmvaluemin', [FC.OVOBOT_FUNCTION.pwmvaluemin]));
            });
        }

        GUI.interval_add('setup_data_pull_slow', get_slow_data, 250, true); // 4 fps

        GUI.content_ready(callback);
    }
};

config.cleanup = function (callback) {
    if (callback) callback();
};

window.TABS.config = config;
export {
    config,
};
