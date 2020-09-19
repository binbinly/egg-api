'use strict';

const Controller = require('./base');

class HomeController extends Controller {

  async index() {
    this.ctx.body = 'hello'
    const a = 'old_room_name'
    console.log(a.slice(4))
  }

  async conf() {
    const { ctx } = this;
    const list = await ctx.model.Config.getAll();
    this.success(list)
  }

  async cat() {
    const ctx = this.ctx;
    const list = await ctx.model.Cat.getAll();
    this.success(list)
  }

  async login() {
    this.success({ user_i1: 1, major_id: 1, username: 'test', avatar: '' });
  }
}

module.exports = HomeController;
