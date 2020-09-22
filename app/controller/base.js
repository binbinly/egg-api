'use strict';

const Controller = require('egg').Controller;

/**
 * 控制器基类
*/
class BaseController extends Controller {

    PAGE_SIZE = 10

    /**
     * 成功返回
     * @param {string} data 数据
     * @param {string} msg 描述
     */
    success(data = '', msg = 'ok') {
        this.ctx.status = 200
        this.ctx.body = {
            code:200,
            msg,
            data
        };
    }

    /**
     * 失败返回
     * @param {*} code 
     * @param {*} msg 
     * @param {*} data 
     */
    error(code = 404, msg = '', data = '') {
        msg = msg || 'not found';
        this.ctx.status = 200
        this.ctx.body = {
            code,
            msg,
            data
        };
    }
}

module.exports = BaseController;
