/// <reference path="../pb_data/types.d.ts" />

// Bulk admin tools (parcel ID correction of 6k+ records) need far more than
// 200 requests / 5 minutes. Keep auth brute-force protections tight; raise the
// general API ceiling so authenticated bulk work can complete.
migrate(
  (app) => {
    const settings = app.settings();
    settings.rateLimits = {
      enabled: true,
      rules: [
        // General API — high ceiling for authenticated bulk ops (corrections,
        // imports, exports). ~100k requests per minute is ample for 10k-record
        // batches while still bounding runaway clients.
        {
          label: "/api",
          audience: "",
          duration: 60,
          maxRequests: 100000,
        },
        // Brute force protection for auth attempts — guests only
        {
          label: "*:auth",
          audience: "@guest",
          duration: 5 * 60,
          maxRequests: 20,
        },
        {
          label: "POST /api/collections/users/request-password-reset",
          audience: "",
          duration: 60 * 60,
          maxRequests: 5,
        },
        {
          label: "POST /api/collections/users/request-verification",
          audience: "",
          duration: 60 * 60,
          maxRequests: 5,
        },
        {
          label: "POST /api/collections/users/request-email-change",
          audience: "@auth",
          duration: 60 * 60,
          maxRequests: 3,
        },
        {
          label: "POST /api/collections/users/request-otp",
          audience: "",
          duration: 60 * 60,
          maxRequests: 10,
        },
      ],
    };
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.rateLimits = {
      enabled: true,
      rules: [
        {
          label: "/api",
          audience: "",
          duration: 5 * 60,
          maxRequests: 200,
        },
        {
          label: "*:auth",
          audience: "@guest",
          duration: 5 * 60,
          maxRequests: 20,
        },
        {
          label: "POST /api/collections/users/request-password-reset",
          audience: "",
          duration: 60 * 60,
          maxRequests: 5,
        },
        {
          label: "POST /api/collections/users/request-verification",
          audience: "",
          duration: 60 * 60,
          maxRequests: 5,
        },
        {
          label: "POST /api/collections/users/request-email-change",
          audience: "@auth",
          duration: 60 * 60,
          maxRequests: 3,
        },
        {
          label: "POST /api/collections/users/request-otp",
          audience: "",
          duration: 60 * 60,
          maxRequests: 10,
        },
      ],
    };
    app.save(settings);
  },
);
