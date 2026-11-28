// v2 booking config. Edit weeklyHours or window and republish. No API.
window.CHITTANANDO_CONFIG = {
  "apiBase": "",
  "email": "ig.permaheal@gmail.com",
  "timezone": "Asia/Kolkata",
  "tzLabel": "IST",
  "defaultService": "soul-speak",
  "services": [
    {
      "id": "soul-speak",
      "name": "Soul Speak (Atmananda)",
      "short": "Soul Speak",
      "duration": 45,
      "grace": 15
    },
    {
      "id": "meditation",
      "name": "Meditation / Mind Mastery (Dhyanananda)",
      "short": "Meditation session",
      "duration": 60,
      "grace": 0
    },
    {
      "id": "discovery",
      "name": "Discovery call",
      "short": "Discovery call",
      "duration": 20,
      "grace": 0
    }
  ],
  "availability": {
    "window": [
      "15:00",
      "16:30"
    ],
    "minNoticeHours": 24,
    "bookingWindowDays": 60,
    "daysPerPage": 14,
    "weeklyHours": {
      "mon": [
        [
          "15:00",
          "16:30"
        ]
      ],
      "tue": [
        [
          "15:00",
          "16:30"
        ]
      ],
      "wed": [
        [
          "15:00",
          "16:30"
        ]
      ],
      "thu": [
        [
          "15:00",
          "16:30"
        ]
      ],
      "fri": [
        [
          "15:00",
          "16:30"
        ]
      ],
      "sat": [
        [
          "15:00",
          "16:30"
        ]
      ],
      "sun": [
        [
          "15:00",
          "16:30"
        ]
      ]
    },
    "closedDates": []
  }
};
