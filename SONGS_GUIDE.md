# Songs Index Guide

歌曲清單放在 `songs/index.json`。每首歌建議獨立放一個資料夾，並在 `media` 區塊明確指定封面、預覽音樂、遊玩影片。

## 建議資料夾

```text
songs/
  My Track/
    cover.png
    preview.mp3
    video.mp4
    chart_easy.json
    chart_hard.json
```

## songs/index.json 格式

```json
{
  "schemaVersion": 2,
  "songs": [
    {
      "id": "my-track",
      "title": "My Track",
      "artist": "Artist Name",
      "folder": "songs/My Track",
      "duration": 90,
      "media": {
        "coverPng": "songs/My Track/cover.png",
        "previewMp3": "songs/My Track/preview.mp3",
        "gameplayMp4": "songs/My Track/video.mp4"
      },
      "difficulties": {
        "easy": {
          "label": "簡單",
          "stars": 2,
          "chart": "songs/My Track/chart_easy.json"
        },
        "hard": {
          "label": "困難",
          "stars": 4,
          "chart": "songs/My Track/chart_hard.json"
        }
      }
    }
  ]
}
```

## media 欄位

- `coverPng`: 選歌畫面顯示的封面圖，建議使用 `.png`。
- `previewMp3`: 選歌停在這首歌時播放的預覽音樂，建議使用 `.mp3`。
- `gameplayMp4`: 遊玩中背景播放的影片，使用 `.mp4`。

如果歌曲暫時沒有某種素材，先把該欄位留成空字串 `""`。如果 `coverPng` 留空，遊戲會嘗試使用該歌曲資料夾裡的 `cover.svg` 當封面備援；如果 `previewMp3` 留空，遊戲會退回使用 `gameplayMp4` 的音訊作為預覽。

## 譜面格式

`time` 是音符出現的秒數，`direction` 是要按的方向。

可用方向：

- `left`
- `down`
- `up`
- `right`

一般音符：

```json
{ "time": 1.25, "direction": "left" }
```

同時按兩個箭頭：放兩個相同 `time`、不同 `direction` 的音符。

```json
{ "time": 2.0, "direction": "left" },
{ "time": 2.0, "direction": "right" }
```

長按箭頭：加上 `hold`，單位是秒。

```json
{ "time": 3.5, "direction": "up", "hold": 0.8 }
```

完整譜面範例：

```json
{
  "duration": 90,
  "notes": [
    { "time": 1.25, "direction": "left" },
    { "time": 2.0, "direction": "left" },
    { "time": 2.0, "direction": "right" },
    { "time": 3.5, "direction": "up", "hold": 0.8 }
  ]
}
```
