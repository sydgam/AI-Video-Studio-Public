// Public demo workflow generated from examples/가이드.aivworkflow.json.
export const GUIDE_WORKFLOW_TEMPLATE = {
  "format": "ai-video-studio-workflow",
  "version": 1,
  "exportedAt": "2026-09-29T02:25:41.835Z",
  "nodes": [
    {
      "id": "node-9o4ndruw",
      "type": "project-overview",
      "disabled": false,
      "x": 15,
      "y": 148.78874869479057,
      "width": 558,
      "height": 270,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-on1zdgld",
      "type": "text-input",
      "disabled": false,
      "x": 15,
      "y": 419,
      "width": 562,
      "height": 261,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-iry3amz8",
      "type": "document-input",
      "disabled": false,
      "x": 15,
      "y": 680,
      "width": 563,
      "height": 309,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-xknlufwn",
      "type": "note",
      "disabled": false,
      "x": -325,
      "y": 680,
      "width": 340,
      "height": 313,
      "config": {
        "text": "갖고 계신 pdf, 문서 자료를 업로드 해 디벨롭을 합니다.",
        "color": "#f6c453",
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-vyjcl4ek",
      "type": "ocr-image",
      "disabled": false,
      "x": 15,
      "y": 989,
      "width": 565,
      "height": 325,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-x60sd974",
      "type": "note",
      "disabled": false,
      "x": -325,
      "y": 1001,
      "width": 340,
      "height": 313,
      "config": {
        "text": "사진 파일로도 가능합니다.",
        "color": "#f6c453",
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-jpfrovvw",
      "type": "google-docs",
      "disabled": false,
      "x": 15,
      "y": 1314,
      "width": 570,
      "height": 316,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-jp9n8l68",
      "type": "note",
      "disabled": false,
      "x": -325,
      "y": 1314,
      "width": 340,
      "height": 313,
      "config": {
        "text": "구글 독스 링크를 삽입해도 됩니다.",
        "color": "#f6c453",
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-dpybjbtt",
      "type": "conversational-agent",
      "disabled": false,
      "x": 803,
      "y": 419,
      "width": 770,
      "height": 449,
      "config": {
        "nodeColor": "violet",
        "provider": "openai-chat",
        "model": "gpt-5.6-sol",
        "modelByProvider": {
          "openai-chat": "gpt-5.6-sol"
        },
        "messages": [],
        "attachments": [],
        "confirmedOutput": ""
      }
    },
    {
      "id": "node-tiecw6vh",
      "type": "openai-chat",
      "disabled": false,
      "x": 803,
      "y": 868,
      "width": 312,
      "height": 197,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-blphabwr",
      "type": "anthropic-chat",
      "disabled": false,
      "x": 803,
      "y": 1065,
      "width": 310,
      "height": 194,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-0lmiismj",
      "type": "google-chat",
      "disabled": false,
      "x": 803,
      "y": 1259,
      "width": 312,
      "height": 185,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-j2nlxh7w",
      "type": "note",
      "disabled": false,
      "x": 1115,
      "y": 868,
      "width": 456,
      "height": 574,
      "config": {
        "text": "대화형 에이전트는 각 모델이 서로의 결과를 보고 의견을 낼 수 있습니다.\n\nGPT - Claude - Gemini 등 별도로 1개의 모델만 사용해도 됩니다.\n\n앞단에 텍스트 입력이나 자료 업로드를 건너 뛰고\n\n대화형 에이전트에 파일을 넘겨 분석해도 됩니다.",
        "color": "#f6c453",
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-boetui4g",
      "type": "human-review",
      "disabled": false,
      "x": 1648,
      "y": 416,
      "width": 699,
      "height": 1007,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-3391wl95",
      "type": "storyboard-output",
      "disabled": false,
      "x": 2391,
      "y": 416,
      "width": 483,
      "height": 1000,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-mwv5qshc",
      "type": "storyboard-input",
      "disabled": false,
      "x": 3520,
      "y": 397,
      "width": 1244,
      "height": 1016,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-4ucvvv8m",
      "type": "note",
      "disabled": false,
      "x": 3914,
      "y": 618,
      "width": 456,
      "height": 574,
      "config": {
        "text": "스토리보드가 여기에 자동으로 작성됩니다.",
        "color": "#f6c453",
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-qeiypydc",
      "type": "image-generator",
      "disabled": false,
      "x": 4834,
      "y": 397,
      "width": 615,
      "height": 1000,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-rni1iyn0",
      "type": "note",
      "disabled": false,
      "x": 4907,
      "y": 875,
      "width": 456,
      "height": 503,
      "config": {
        "text": "스토리 보드의 컷을 선택하면 자동으로 \n\n프롬프트가 작성됩니다.\n\n생성된 결과물은 이 노드에 바로 보여집니다.",
        "color": "#f6c453",
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-22omkjg3",
      "type": "global-style",
      "disabled": false,
      "x": 2972,
      "y": 1276,
      "width": 434,
      "height": 280,
      "config": {
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-lg9inya5",
      "type": "note",
      "disabled": false,
      "x": 2972,
      "y": 1538,
      "width": 434,
      "height": 272,
      "config": {
        "text": "원하는 스타일의 이미지를 업로드 하면  스타일을 반영한 이미지 프롬프트가 나옵니다.",
        "color": "#f6c453",
        "nodeColor": "blue"
      }
    },
    {
      "id": "node-qq280c4o",
      "type": "video-generator",
      "disabled": false,
      "x": 5549,
      "y": 397,
      "width": 794,
      "height": 991,
      "config": {
        "nodeColor": "blue",
        "model": "seedance-2.0-mini",
        "resolution": "480p",
        "aspectRatio": "16:9",
        "duration": 5,
        "generateAudio": true,
        "enableSafetyChecker": true,
        "prompt": "앞서 생성된 이미지로 영상을 만들 수 있습니다. "
      }
    }
  ],
  "edges": [
    {
      "fromNodeId": "node-9o4ndruw",
      "toNodeId": "node-dpybjbtt"
    },
    {
      "fromNodeId": "node-on1zdgld",
      "toNodeId": "node-dpybjbtt"
    },
    {
      "fromNodeId": "node-iry3amz8",
      "toNodeId": "node-dpybjbtt"
    },
    {
      "fromNodeId": "node-vyjcl4ek",
      "toNodeId": "node-dpybjbtt"
    },
    {
      "fromNodeId": "node-jpfrovvw",
      "toNodeId": "node-dpybjbtt"
    },
    {
      "fromNodeId": "node-dpybjbtt",
      "toNodeId": "node-boetui4g"
    },
    {
      "fromNodeId": "node-boetui4g",
      "toNodeId": "node-3391wl95"
    },
    {
      "fromNodeId": "node-mwv5qshc",
      "toNodeId": "node-qeiypydc"
    },
    {
      "fromNodeId": "node-22omkjg3",
      "toNodeId": "node-mwv5qshc"
    },
    {
      "fromNodeId": "node-qeiypydc",
      "toNodeId": "node-qq280c4o"
    }
  ],
  "groups": [],
  "viewport": {
    "x": 123.74220568829332,
    "y": 955.2426727461966,
    "zoom": 0.25
  }
};
