'use strict';

const Controller = require('./base');

/**
 * 公共
 */
class HomeController extends Controller {

  async index() {
    this.ctx.body = 'hello'

  }

  /**
   * 获取配置
   */
  async conf() {
    const { ctx } = this;
    const list = await ctx.model.Config.getAll();
    this.success(list)
  }

  /**
   * 专业分类
   */
  async cat() {
    const ctx = this.ctx;
    const list = await ctx.model.Cat.getAll();
    this.success(list)
  }

  /**
   * 登录
   */
  async login() {
    this.success({ user_i1: 1, major_id: 1, username: 'test', avatar: '' });
  }
}

module.exports = HomeController;
