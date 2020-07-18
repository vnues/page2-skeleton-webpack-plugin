## 1.安装说明
### 1.1 Failed to download Chromium
```js
Downloading Chromium r686378 - 143 Mb [======              ] 30% 25.6s ERROR: Failed to download Chromium r686378! Set "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD" env variable to skip download.
```
出现这个错误的原因是由于安装Puppeteer(一个Node库，它提供了一个高级API来控制DevTools协议上的Chrome或Chromium)时，会自动下载最新版本的Chromium。但是由于该网站被墙，所以
就下载不成功了。我们可以设置环境变量来阻止下载

```js
$ set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
```
然后可以手工下载 



放在这个目录中
C:\bprepare\page2-skeleton-webpack-plugin\examples\sale\node_modules\puppeteer\.local-chromium\win64-768783\chrome-win
