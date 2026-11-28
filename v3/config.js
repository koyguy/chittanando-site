// v3 booking config. showPrices is baked into the HTML at render time as well.
window.CHITTANANDO_CONFIG = {
  "apiBase": "",
  "email": "ig.permaheal@gmail.com",
  "timezone": "Asia/Kolkata",
  "tzLabel": "IST",
  "defaultService": "soul-speak",
  "showPrices": true,
  "services": [
    {
      "id": "soul-speak",
      "name": "Soul Speak",
      "short": "Soul Speak",
      "duration": 45,
      "grace": 15
    },
    {
      "id": "meditation",
      "name": "Meditation / Mind Mastery",
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
      "10:00",
      "18:00"
    ],
    "minNoticeHours": 24,
    "bookingWindowDays": 60,
    "daysPerPage": 14,
    "weeklyHours": {
      "mon": [
        [
          "10:00",
          "18:00"
        ]
      ],
      "tue": [
        [
          "10:00",
          "18:00"
        ]
      ],
      "wed": [
        [
          "10:00",
          "18:00"
        ]
      ],
      "thu": [
        [
          "10:00",
          "18:00"
        ]
      ],
      "fri": [
        [
          "10:00",
          "18:00"
        ]
      ],
      "sat": [
        [
          "10:00",
          "18:00"
        ]
      ],
      "sun": []
    },
    "closedDates": []
  }
};
