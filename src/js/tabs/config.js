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

        // translate to user-selected language
        i18n.localizePage();

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

            MSP.send_message(MSPCodes.MSP_GET_PWMVALUE, false, false, function () {
                // console.log("==========pwmvaluemax:" + [FC.OVOBOT_FUNCTION.pwmvaluemax]);
                let pwmvaluemax = [FC.OVOBOT_FUNCTION.pwmvaluemax];
                general_fan.val(i18n.getMessage('pwmvalue', [FC.OVOBOT_FUNCTION.pwmvalue]));
                if (Number(pwmvaluemax) === 0) {
                    max_fan.parent('div').hide();
                    min_fan.parent('div').hide();
                } else {
                    max_fan.val(i18n.getMessage('pwmvaluemax', [FC.OVOBOT_FUNCTION.pwmvaluemax]));
                    min_fan.val(i18n.getMessage('pwmvaluemin', [FC.OVOBOT_FUNCTION.pwmvaluemin]));
                }
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
