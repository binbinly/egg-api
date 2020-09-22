# api
项目主要目录如下
/app 应用
/app/controller 控制器
/app/extend 类库
/app/model 模型，对应数据库表
/app/schedule 定时器
/app/service 服务 游戏逻辑代码
/app/router.js 路由定义

/config 配置文件
app.js 主要用于延时队列，延时发送消息至客户端
package.json 第三方包管理
其他目录可以忽略

### Development

```bash
$ npm i
$ npm run dev
$ open http://localhost:7001/
```

### Deploy

```bash
$ npm start
$ npm stop
```
