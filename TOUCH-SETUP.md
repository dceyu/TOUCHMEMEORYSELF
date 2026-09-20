# CENTOPIA 1.8 — 电容触摸 / Capacitive touch

适用 Uno R3 / ATmega328P。保留教授的 7 组接线，发送端与接收端之间用 1 MΩ 电阻，电极接右侧接收端：

| CH | 发送 → 接收（电极） | 事件 |
|---|---|---|
| 1 | D2 → D3 | 怀疑 |
| 2 | D4 → D5 | 探索 |
| 3 | D6 → D7 | 欲望 |
| 4 | D8 → D9 | 自信 |
| 5 | D10 → D11 | 冲突 |
| 6 | A0 → A1 | 虚无 |
| 7 | A2 → A3 | 接纳 |
| 8 | 默认 D12 ↔ GND 常开按钮；可选 A4 → A5 + 1 MΩ | 结束消散 |

**不要沿用旧版 D3–D10 按钮接地接线。D2 已占用。各触摸电极不能全部连接 GND。改线前拔下 USB，固定并绝缘裸露电阻脚，避免短路。**

## 首次操作
1. 保存当前项目及教授原程序。选择软件 Arduino 页 → 电容触摸 · 教授接线方案。
2. 确认上述接线，选择 USB 串口。可先“验证程序”；之后手动“写入 Uno 并连接”，再次确认才会覆盖开发板。仅支持 Uno R3，不支持 Uno R4。
3. 等待“配置已确认”。原始 9600 baud 的 SENSOR_n_ON 程序不兼容此模式；新版为 115200 JSON 协议。
4. 移开所有手和物体，点击“无人触摸校准 · 2 秒”。校准收集各路最大空闲计数作为基准，不自动追踪长按。
5. 逐路测试。触发条件：读数 ≥ 基准 + 触发差，持续按下确认时间。释放条件：读数 ≤ 基准 + 释放差，持续松手确认时间。
6. 先选电阻/灵敏度预设：1 MΩ、4.7 MΩ、10 MΩ 或自定义，再按材料调整采样次数与检测上限。默认触发差 5、释放差 3，按下 60 ms、松手 100 ms。读数达到当前检测上限代表饱和；若基准过高导致无法容纳触发差，校准报错且保留旧设置。1 kΩ（棕黑红金）阻值过低，软件灵敏度不能补偿，应换成至少 1 MΩ。
7. 松手后再次触摸应再次触发，持续长按不循环。校准、配置变更、重连后均要求先释放。CH8 结束后由“恢复播放”恢复。
8. “保存”保存当前项目；“导出设置与素材”包含校准、常态参数、事件参数、匹配的新固件及教授原版备份。复制整个文件夹到另一电脑，导入 settings.centopia-settings 并重选串口与显示器。

## 参数与状态
- 通道启用/接管开关仍生效。触摸模式使用固件逐路去抖，不叠加原来的统一去抖与反向判断。
- CH8 按钮/触摸选项可通过配置同步切换，无需重复刷写；必须先按所选方式正确接线。
- 修改参数先显示“同步中”，收到开发板确认才允许触发。重复同步失败时保持禁止触发，不假装成功。
- 无操作也持续发送状态。电脑每约 500 ms 发确认心跳；固件超过 2 秒无有效主机心跳将解除触发。桌面超过 500 ms 没有新状态时停止接受硬件事件。
- 触摸计数是开发板自启动以来的检测次数，不是粒子事件的播放次数；禁用通道或结束状态下仍可能检测到触摸。
- 设置以项目文件为准，重连后自动下发，不写入 EEPROM。单独编译的固件需要 CENTOPIA 配置握手才开始输出触发，避免启动误触发。
- 不要同时用串口监视器和 CENTOPIA 占用同一个串口。

## 文件
- firmware/professor-original/professor-original.ino：教授原版，仅清理聊天格式。
- firmware/centopia-touch-button/centopia-touch-button.ino：默认 D12 结束按钮版本。
- firmware/centopia-touch-touch/centopia-touch-touch.ino：默认 A4/A5 结束触摸版本。
- 两份新版固件均支持运行时切换 CH8 方式。软件导出源码还包含当前校准与阈值初始值。

## English quick start
Use an Uno R3, 1 MΩ between each send/receive pair, electrode on receive. Select **Capacitive touch · professor pin pairs**, choose the port, verify and explicitly upload. Wait for configuration acknowledgement. Remove hands/objects and calibrate for two seconds. Adjust per-channel baseline offsets and press/release times. Save or export the complete settings/media folder. Release before re-touching after calibration/configuration/reconnect. CH8 defaults to a normally-open D12–GND button, or choose A4–A5 touch. D2 is not a Final input in this mode. The original professor sketch uses a different protocol and must not be mistaken for the new firmware.

## 现场验收 / Physical acceptance still required
每路 20 次、长按 10 秒、无人触摸 10 分钟、相邻区域/多人同时触摸、实际线长与投影机通电测试、CH8 与恢复、USB 拔插测试。软件模拟及编译无法代替实际电极的灵敏度、串扰与静电/环境干扰验证。
