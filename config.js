// Runtime settings. apiBase = public URL of the booking API ('' = same origin). If the API is unreachable,
// the booking form switches to 'email mode' and uses the availability rules below to show times.
window.CHITTANANDO_CONFIG = {
  "apiBase": "",
  "email": "ig.permaheal@gmail.com",
  "timezone": "Asia/Kolkata",
  "tzLabel": "IST",
  "services": [
    {
      "id": "enquiry",
      "duration": 20
    },
    {
      "id": "mind-mastery",
      "duration": 60
    },
    {
      "id": "soul-speak",
      "duration": 45
    }
  ],
  "availability": {
    "slotIntervalMinutes": 60,
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
