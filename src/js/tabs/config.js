import { data, isEmptyObject } from "jquery";
import { i18n } from "../localization";

const config = {
};

config.initialize = function (callback) {

    if (GUI.active_tab != 'config') {
        GUI.active_tab = 'config';

    }

    function load_status() {
        load_html();
    }

    function load_html() {
        $('#content').load("./tabs/config.html", process_html);
    }

    load_status();

    function process_html() {

        const general_fan = $('#general-fan'),
            max_fan = $('#max-fan'),
            min_fan = $('#min-fan'),
            constant_fan = $('#constant-fan'),
            constant_max_fan = $('#constant-max-fan'),
            constant_min_fan = $('#constant-min-fan'),
            constant_suction = $('#constant-suction'),
            constant_max_suction = $('#constant-max-suction'),
            constant_min_suction = $('#constant-min-suction');
        const general_min_motor = $("#general-min-motor"),
            up_min_motor = $("#up-min-motor");

        // translate to user-selected language
        i18n.localizePage();

        $('.model_open_close').click(function () {
            $(this).toggleClass('rotate-90');
            $(this).closest('.grid-row').find('.grid-row-content').toggleClass('model-display');
        });

        $('.edit-fan a').click(function () {
            $(this).closest('.grid-row').find('input').removeAttr("readonly");
            $(this).closest('.grid-row').find('input').removeClass('model-background');
            $(this).closest('.model-btn').find('a').removeClass('no-click');
            $(this).addClass('no-click');
            $(this).closest('.grid-row').find('input').attr('type', 'number');
        });
        const message = i18n.getMessage('dialogConfirmCancel');
        // GUI.log(message);//日志
        const dialogConfirmCancel = $('.dialogConfirmCancel')[0];
        let model_div = '';
        let model_btn_div = '';
        $('.cancle-fan a').click(function () {
            $('.dialogConfirmCancel-content').html(message);
            dialogConfirmCancel.showModal();

            model_div = $(this).closest('.grid-row-content');
            model_btn_div = $(this).closest('.model-btn');
        });
        $('.dialogConfirmCancel-closebtn').click(function () {
            dialogConfirmCancel.close();
        });
        $('.dialogConfirmCancel-confirmbtn').click(function () {
            model_div.find('input').prop('readonly', true);
            model_div.find('input').addClass('model-background');
            model_btn_div.find('a').addClass('no-click');
            model_btn_div.find('.edit-fan').children('a').removeClass('no-click');
            model_div.find('input').attr('type', 'text');

            get_slow_data(model_div.attr("id"));
            model_div.find('input').parent().children('div').removeClass('edit-sign');
            dialogConfirmCancel.close();
        });

        //保存
        const messageSave = i18n.getMessage('dialogConfirmSave');
        const dialogConfirmSave = $('.dialogConfirmSave')[0];
        $('.save-fan a').click(function () {
            $('.dialogConfirmSave-content').html(messageSave);
            dialogConfirmSave.showModal();

            model_div = $(this).closest('.grid-row-content');
            model_btn_div = $(this).closest('.model-btn');
        });
        $('.dialogConfirmSave-closebtn').click(function () {
            dialogConfirmSave.close();
        });

        $('.dialogConfirmSave-confirmbtn').click(function () {
            model_div.find('input').prop('readonly', true);
            model_div.find('input').addClass('model-background');
            model_btn_div.find('a').addClass('no-click');
            model_btn_div.find('.edit-fan').children('a').removeClass('no-click');
            model_div.find('input').attr('type', 'text');

            set_slow_data(model_div.attr("id"));
            get_slow_data(model_div.attr("id"));
            model_div.find('input').parent().children('div').removeClass('edit-sign');
            dialogConfirmSave.close();
        });
        //监听input值是否被修改
        $('.content_wrapper').on('input','input', function () {
            $(this).parent().children('div').addClass('edit-sign');
        });


        function get_slow_data(id) {
            if (isEmptyObject(id) == false && undefined != id) {
                if (id == 'model-fan') {
                    get_fan_data();
                } else if (id == 'model-motor') {
                    get_motor_data();
                } else if (id == 'model-spary') {

                } else if (id == 'model-motor1') {

                } else if (id == 'model-motor1') {

                }
            } else {
                get_fan_data();
                get_motor_data();
            }
        }
        function set_slow_data(id) {
            if (isEmptyObject(id) == false && undefined != id) {
                if (id == 'model-fan') {
                    set_fan_data();
                } else if (id == 'model-motor') {
                    set_motor_data();
                } else if (id == 'model-spary') {

                } else if (id == 'model-motor1') {

                } else if (id == 'model-motor1') {

                }
            } else {
                set_fan_data();
                set_motor_data();
            }
        }

        function set_fan_data() {
            let generalfanval = '';
            let ischange = general_fan.parent().children('div').hasClass("edit-sign");
            if (ischange == true) {
                generalfanval = general_fan.val();
            }
            MSP.send_message(MSPCodes.MSP_SET_PWMVALUE, [generalfanval], false, function () {

            });

            MSP.send_message(MSPCodes.MSP_SET_USE_FAN_LEVEL_DYNAMIC_COMP, [max_fan.val(), min_fan.val()], false, function () {

            });
            let data_constant = [];
            data_constant.push(constant_fan.val());
            data_constant.push(constant_max_fan.val());
            data_constant.push(constant_min_fan.val());
            let constant_suction_val = (constant_suction.val() * 100).toFixed(2);
            data_constant.push((constant_suction_val & 0xff), constant_suction_val >> 8);
            let constant_max_suction_val = (constant_max_suction.val() * 100).toFixed(2);
            data_constant.push((constant_max_suction_val & 0xff), constant_max_suction_val >> 8);
            let constant_min_suction_val = (constant_min_suction.val() * 100).toFixed(2);
            data_constant.push((constant_min_suction_val & 0xff), constant_min_suction_val >> 8);
            MSP.send_message(MSPCodes.MSP_SET_USE_FAN_OUTPUT_PID, data_constant, false, function () {
            });
        }
        function set_motor_data() {

            MSP.send_message(MSPCodes.MSP_SET_MOTOR_VALUE, [general_min_motor.val(), up_min_motor.val()], false, function () {

            });
        }

        function get_fan_data() {
            max_fan.parent('div').hide();
            min_fan.parent('div').hide();
            $(".constant-fan").hide();
            MSP.send_message(MSPCodes.MSP_GET_PWMVALUE, false, false, function () {
                general_fan.val(i18n.getMessage('pwmvalue', [FC.OVOBOT_FUNCTION.pwmvalue]));
            });
            MSP.send_message(MSPCodes.MSP_GET_USE_FAN_LEVEL_DYNAMIC_COMP, false, false, function () {
                let pwmvaluemax = [FC.OVOBOT_FUNCTION.pwmvaluemax];
                if (Number(pwmvaluemax) !== 0) {
                    max_fan.val(i18n.getMessage('pwmvaluemax', [FC.OVOBOT_FUNCTION.pwmvaluemax]));
                    min_fan.val(i18n.getMessage('pwmvaluemin', [FC.OVOBOT_FUNCTION.pwmvaluemin]));
                    min_fan.parent('div').show();
                    max_fan.parent('div').show();
                }
            });

            MSP.send_message(MSPCodes.MSP_GET_USE_FAN_OUTPUT_PID, false, false, function () {
                let fanpwmvalueatidel = [FC.OVOBOT_FUNCTION.fanpwmvalueatidel];
                if (Number(fanpwmvalueatidel) !== 0) {
                    constant_fan.val(i18n.getMessage('fanpwmvalueatidel', [FC.OVOBOT_FUNCTION.fanpwmvalueatidel]));
                    constant_max_fan.val(i18n.getMessage('fanpwmmax', [FC.OVOBOT_FUNCTION.fanpwmmax]));
                    constant_min_fan.val(i18n.getMessage('fanpwmmin', [FC.OVOBOT_FUNCTION.fanpwmmin]));
                    constant_suction.val(i18n.getMessage('defaulttargetfanpwmvalue', [(FC.OVOBOT_FUNCTION.defaulttargetfanpwmvalue / 100).toFixed(2)]));
                    constant_max_suction.val(i18n.getMessage('maxtargetfanpwmvalue', [(FC.OVOBOT_FUNCTION.maxtargetfanpwmvalue / 100).toFixed(2)]));
                    constant_min_suction.val(i18n.getMessage('mintargetfanpwmvalue', [(FC.OVOBOT_FUNCTION.mintargetfanpwmvalue / 100).toFixed(2)]));
                    $(".constant-fan").show();
                    general_fan.parent().parent('div').hide();
                }
            });
        }
        function get_motor_data() {

            MSP.send_message(MSPCodes.MSP_GET_MOTOR_VALUE, false, false, function () {
                general_min_motor.val(i18n.getMessage('minpwmvalue', [FC.OVOBOT_FUNCTION.minpwmvalue]));
                up_min_motor.val(i18n.getMessage('upminpwmvalue', [FC.OVOBOT_FUNCTION.upminpwmvalue]));
            });

        }
        //清空所有的input
        // $('input').val('');
        get_slow_data();

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
