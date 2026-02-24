// ── Agent Data ─────────────────────────────────────────────────────────────────
export const ALL_AGENTS = [
  // purnima — 5 days
  {date:"2026-02-16",name:"purnima",ext:"0294",loginTime:"10:21 AM",logoutTime:"07:07 PM",loginDur:"08:46:19",outCalls:609,outTT:"02:17:13",manCalls:9,manTT:"00:01:19",totalTT:"02:18:32",autoIdle:"04:08:10",manualIdle:"00:06:51",breakTime:"01:11:33",wrapup:"01:01:27",loginMin:621,logoutMin:1147},
  {date:"2026-02-17",name:"purnima",ext:"0294",loginTime:"10:23 AM",logoutTime:"09:57 AM",loginDur:"23:06:17",outCalls:343,outTT:"01:59:30",manCalls:6,manTT:"00:01:19",totalTT:"02:00:49",autoIdle:"03:15:12",manualIdle:"00:02:52",breakTime:"15:58:21",wrapup:"01:46:06",loginMin:623,logoutMin:597},
  {date:"2026-02-18",name:"purnima",ext:"0294",loginTime:"10:24 AM",logoutTime:"07:00 PM",loginDur:"08:32:41",outCalls:377,outTT:"02:18:25",manCalls:4,manTT:"00:00:31",totalTT:"02:18:56",autoIdle:"03:10:34",manualIdle:"00:03:21",breakTime:"01:41:55",wrapup:"01:17:55",loginMin:624,logoutMin:1200},
  {date:"2026-02-19",name:"purnima",ext:"0294",loginTime:"10:21 AM",logoutTime:"07:17 PM",loginDur:"08:56:07",outCalls:392,outTT:"02:24:53",manCalls:0,manTT:"00:00:00",totalTT:"02:24:53",autoIdle:"03:15:06",manualIdle:"00:00:00",breakTime:"02:06:30",wrapup:"01:06:16",loginMin:621,logoutMin:1157},
  {date:"2026-02-20",name:"purnima",ext:"0294",loginTime:"10:22 AM",logoutTime:"07:00 PM",loginDur:"08:35:44",outCalls:386,outTT:"02:09:31",manCalls:4,manTT:"00:00:00",totalTT:"02:09:31",autoIdle:"03:51:32",manualIdle:"00:02:46",breakTime:"01:16:33",wrapup:"01:15:21",loginMin:622,logoutMin:1200},
  // Aryan — 5 days
  {date:"2026-02-16",name:"Aryan",ext:"0339",loginTime:"10:26 AM",logoutTime:"07:01 PM",loginDur:"08:25:52",outCalls:601,outTT:"02:11:16",manCalls:1,manTT:"00:00:00",totalTT:"02:11:16",autoIdle:"03:40:24",manualIdle:"00:07:33",breakTime:"00:28:55",wrapup:"01:57:44",loginMin:626,logoutMin:1141},
  {date:"2026-02-17",name:"Aryan",ext:"0339",loginTime:"10:25 AM",logoutTime:"07:05 PM",loginDur:"08:40:13",outCalls:370,outTT:"02:10:10",manCalls:0,manTT:"00:00:00",totalTT:"02:10:10",autoIdle:"03:18:13",manualIdle:"00:05:36",breakTime:"01:02:22",wrapup:"02:03:53",loginMin:625,logoutMin:1145},
  {date:"2026-02-18",name:"Aryan",ext:"0339",loginTime:"10:25 AM",logoutTime:"07:03 PM",loginDur:"08:38:06",outCalls:346,outTT:"02:26:06",manCalls:0,manTT:"00:00:00",totalTT:"02:26:06",autoIdle:"03:16:21",manualIdle:"00:16:47",breakTime:"00:59:42",wrapup:"01:39:10",loginMin:625,logoutMin:1143},
  {date:"2026-02-19",name:"Aryan",ext:"0339",loginTime:"10:25 AM",logoutTime:"07:07 PM",loginDur:"08:41:11",outCalls:409,outTT:"02:28:44",manCalls:0,manTT:"00:00:00",totalTT:"02:28:44",autoIdle:"03:35:02",manualIdle:"00:05:58",breakTime:"01:01:13",wrapup:"01:30:14",loginMin:625,logoutMin:1147},
  {date:"2026-02-20",name:"Aryan",ext:"0339",loginTime:"10:24 AM",logoutTime:"07:11 PM",loginDur:"08:39:33",outCalls:391,outTT:"01:36:25",manCalls:0,manTT:"00:00:00",totalTT:"01:36:25",autoIdle:"03:48:14",manualIdle:"00:35:41",breakTime:"01:02:21",wrapup:"01:36:52",loginMin:624,logoutMin:1151},
  // TEJESVI CHADHA — 5 days
  {date:"2026-02-16",name:"TEJESVI CHADHA",ext:"0231",loginTime:"10:26 AM",logoutTime:"07:01 PM",loginDur:"08:35:24",outCalls:294,outTT:"02:35:41",manCalls:2,manTT:"00:00:15",totalTT:"02:35:56",autoIdle:"01:36:05",manualIdle:"00:20:21",breakTime:"01:53:12",wrapup:"01:48:38",loginMin:626,logoutMin:1141},
  {date:"2026-02-17",name:"TEJESVI CHADHA",ext:"0231",loginTime:"10:29 AM",logoutTime:"07:01 PM",loginDur:"08:32:07",outCalls:260,outTT:"02:29:48",manCalls:0,manTT:"00:00:00",totalTT:"02:29:48",autoIdle:"02:00:10",manualIdle:"00:23:16",breakTime:"00:57:33",wrapup:"02:34:30",loginMin:629,logoutMin:1141},
  {date:"2026-02-18",name:"TEJESVI CHADHA",ext:"0231",loginTime:"10:28 AM",logoutTime:"06:59 PM",loginDur:"08:21:00",outCalls:222,outTT:"01:59:53",manCalls:0,manTT:"00:00:00",totalTT:"01:59:53",autoIdle:"01:35:25",manualIdle:"00:11:12",breakTime:"02:01:05",wrapup:"02:07:09",loginMin:628,logoutMin:1139},
  {date:"2026-02-19",name:"TEJESVI CHADHA",ext:"0231",loginTime:"10:04 AM",logoutTime:"06:58 PM",loginDur:"08:53:24",outCalls:210,outTT:"02:32:40",manCalls:14,manTT:"00:01:22",totalTT:"02:34:02",autoIdle:"01:33:15",manualIdle:"00:31:56",breakTime:"01:31:44",wrapup:"01:52:29",loginMin:604,logoutMin:1138},
  {date:"2026-02-20",name:"TEJESVI CHADHA",ext:"0231",loginTime:"10:13 AM",logoutTime:"07:06 PM",loginDur:"08:52:30",outCalls:252,outTT:"02:26:56",manCalls:0,manTT:"00:00:00",totalTT:"02:26:56",autoIdle:"02:29:31",manualIdle:"00:36:40",breakTime:"01:31:00",wrapup:"01:46:56",loginMin:613,logoutMin:1146},
  // mohit — 5 days
  {date:"2026-02-16",name:"mohit",ext:"0331",loginTime:"10:26 AM",logoutTime:"07:07 PM",loginDur:"08:29:14",outCalls:567,outTT:"02:23:44",manCalls:17,manTT:"00:06:33",totalTT:"02:32:13",autoIdle:"03:56:14",manualIdle:"00:16:54",breakTime:"00:54:47",wrapup:"00:49:25",loginMin:626,logoutMin:1147},
  {date:"2026-02-17",name:"mohit",ext:"0331",loginTime:"10:25 AM",logoutTime:"06:38 PM",loginDur:"08:12:53",outCalls:350,outTT:"02:11:16",manCalls:30,manTT:"00:11:18",totalTT:"02:24:38",autoIdle:"03:29:33",manualIdle:"00:31:38",breakTime:"01:00:12",wrapup:"00:44:24",loginMin:625,logoutMin:1118},
  {date:"2026-02-18",name:"mohit",ext:"0331",loginTime:"10:25 AM",logoutTime:"07:08 PM",loginDur:"08:43:21",outCalls:374,outTT:"02:24:02",manCalls:24,manTT:"00:19:15",totalTT:"02:46:18",autoIdle:"03:32:51",manualIdle:"00:21:02",breakTime:"01:13:16",wrapup:"00:49:59",loginMin:625,logoutMin:1148},
  {date:"2026-02-19",name:"mohit",ext:"0331",loginTime:"10:25 AM",logoutTime:"07:28 PM",loginDur:"09:00:28",outCalls:460,outTT:"02:18:20",manCalls:58,manTT:"00:14:09",totalTT:"02:32:29",autoIdle:"03:55:49",manualIdle:"00:37:38",breakTime:"00:58:36",wrapup:"00:52:59",loginMin:625,logoutMin:1168},
  {date:"2026-02-20",name:"mohit",ext:"0331",loginTime:"10:25 AM",logoutTime:"07:09 PM",loginDur:"08:44:28",outCalls:399,outTT:"02:19:33",manCalls:55,manTT:"00:06:19",totalTT:"02:26:27",autoIdle:"03:48:21",manualIdle:"00:39:19",breakTime:"01:09:07",wrapup:"00:41:54",loginMin:625,logoutMin:1149},
  // Sandeep — 5 days
  {date:"2026-02-16",name:"Sandeep",ext:"0345",loginTime:"10:26 AM",logoutTime:"07:10 PM",loginDur:"08:43:01",outCalls:615,outTT:"02:34:28",manCalls:0,manTT:"00:00:00",totalTT:"02:34:28",autoIdle:"04:06:13",manualIdle:"00:00:00",breakTime:"00:55:05",wrapup:"01:07:15",loginMin:626,logoutMin:1150},
  {date:"2026-02-17",name:"Sandeep",ext:"0345",loginTime:"10:24 AM",logoutTime:"07:02 PM",loginDur:"08:37:13",outCalls:373,outTT:"02:29:15",manCalls:0,manTT:"00:00:00",totalTT:"02:29:15",autoIdle:"03:48:30",manualIdle:"00:00:00",breakTime:"01:02:29",wrapup:"01:16:57",loginMin:624,logoutMin:1142},
  {date:"2026-02-18",name:"Sandeep",ext:"0345",loginTime:"10:25 AM",logoutTime:"07:04 PM",loginDur:"08:38:41",outCalls:417,outTT:"02:40:28",manCalls:0,manTT:"00:00:00",totalTT:"02:40:28",autoIdle:"03:42:44",manualIdle:"00:00:00",breakTime:"00:56:40",wrapup:"01:18:49",loginMin:625,logoutMin:1144},
  {date:"2026-02-19",name:"Sandeep",ext:"0345",loginTime:"10:22 AM",logoutTime:"07:01 PM",loginDur:"08:39:24",outCalls:486,outTT:"02:21:10",manCalls:0,manTT:"00:00:00",totalTT:"02:21:10",autoIdle:"04:17:46",manualIdle:"00:03:11",breakTime:"00:59:59",wrapup:"00:57:15",loginMin:622,logoutMin:1141},
  {date:"2026-02-20",name:"Sandeep",ext:"0345",loginTime:"10:24 AM",logoutTime:"07:06 PM",loginDur:"08:39:59",outCalls:429,outTT:"01:53:12",manCalls:0,manTT:"00:00:00",totalTT:"01:53:12",autoIdle:"04:35:34",manualIdle:"00:00:38",breakTime:"00:59:01",wrapup:"00:44:31",loginMin:624,logoutMin:1146},
  // Mahak — 4 days
  {date:"2026-02-17",name:"Mahak",ext:"0337",loginTime:"10:28 AM",logoutTime:"07:05 PM",loginDur:"08:27:25",outCalls:308,outTT:"02:27:23",manCalls:0,manTT:"00:00:00",totalTT:"02:27:23",autoIdle:"03:38:15",manualIdle:"00:18:31",breakTime:"01:43:43",wrapup:"00:19:33",loginMin:628,logoutMin:1145},
  {date:"2026-02-18",name:"Mahak",ext:"0337",loginTime:"10:19 AM",logoutTime:"07:08 PM",loginDur:"08:45:09",outCalls:378,outTT:"03:11:05",manCalls:3,manTT:"00:00:00",totalTT:"03:11:05",autoIdle:"03:58:16",manualIdle:"00:02:03",breakTime:"01:12:54",wrapup:"00:20:51",loginMin:619,logoutMin:1148},
  {date:"2026-02-19",name:"Mahak",ext:"0337",loginTime:"10:03 AM",logoutTime:"07:03 PM",loginDur:"08:59:22",outCalls:374,outTT:"02:55:53",manCalls:0,manTT:"00:00:00",totalTT:"02:55:53",autoIdle:"03:33:42",manualIdle:"00:20:41",breakTime:"01:47:48",wrapup:"00:21:19",loginMin:603,logoutMin:1143},
  {date:"2026-02-20",name:"Mahak",ext:"0337",loginTime:"09:54 AM",logoutTime:"07:05 PM",loginDur:"08:59:14",outCalls:378,outTT:"02:29:44",manCalls:19,manTT:"00:00:46",totalTT:"02:30:30",autoIdle:"04:11:40",manualIdle:"00:37:16",breakTime:"01:12:10",wrapup:"00:27:42",loginMin:594,logoutMin:1145},
  // gunjansaini — 5 days
  {date:"2026-02-16",name:"gunjansaini",ext:"0309",loginTime:"12:32 PM",logoutTime:"07:01 PM",loginDur:"06:27:00",outCalls:384,outTT:"01:03:41",manCalls:0,manTT:"00:00:00",totalTT:"01:03:41",autoIdle:"02:16:47",manualIdle:"00:01:59",breakTime:"01:30:44",wrapup:"01:33:48",loginMin:752,logoutMin:1141},
  {date:"2026-02-17",name:"gunjansaini",ext:"0309",loginTime:"10:21 AM",logoutTime:"07:01 PM",loginDur:"08:36:37",outCalls:421,outTT:"01:33:47",manCalls:8,manTT:"00:05:52",totalTT:"01:39:39",autoIdle:"04:17:15",manualIdle:"00:03:20",breakTime:"01:23:51",wrapup:"01:12:36",loginMin:621,logoutMin:1141},
  {date:"2026-02-18",name:"gunjansaini",ext:"0309",loginTime:"10:25 AM",logoutTime:"07:00 PM",loginDur:"08:28:13",outCalls:493,outTT:"02:09:24",manCalls:16,manTT:"00:00:02",totalTT:"02:09:26",autoIdle:"04:31:29",manualIdle:"00:04:38",breakTime:"00:37:09",wrapup:"01:05:44",loginMin:625,logoutMin:1200},
  {date:"2026-02-19",name:"gunjansaini",ext:"0309",loginTime:"10:22 AM",logoutTime:"07:32 PM",loginDur:"09:03:59",outCalls:404,outTT:"02:14:26",manCalls:0,manTT:"00:00:00",totalTT:"02:14:26",autoIdle:"03:32:15",manualIdle:"00:00:00",breakTime:"02:05:07",wrapup:"01:12:14",loginMin:622,logoutMin:1172},
  {date:"2026-02-20",name:"gunjansaini",ext:"0309",loginTime:"10:15 AM",logoutTime:"07:06 PM",loginDur:"08:45:19",outCalls:397,outTT:"01:38:39",manCalls:6,manTT:"00:00:03",totalTT:"01:38:42",autoIdle:"03:42:24",manualIdle:"00:06:47",breakTime:"01:32:46",wrapup:"01:44:51",loginMin:615,logoutMin:1146},
  // Adesh — 5 days
  {date:"2026-02-16",name:"Adesh",ext:"0342",loginTime:"10:26 AM",logoutTime:"07:10 PM",loginDur:"08:43:59",outCalls:501,outTT:"02:24:14",manCalls:1,manTT:"00:00:13",totalTT:"02:24:27",autoIdle:"03:26:17",manualIdle:"00:07:24",breakTime:"01:41:35",wrapup:"00:56:11",loginMin:626,logoutMin:1150},
  {date:"2026-02-17",name:"Adesh",ext:"0342",loginTime:"10:24 AM",logoutTime:"07:08 PM",loginDur:"08:44:24",outCalls:338,outTT:"02:17:47",manCalls:2,manTT:"00:00:00",totalTT:"02:17:47",autoIdle:"03:29:05",manualIdle:"00:02:17",breakTime:"01:51:10",wrapup:"01:04:11",loginMin:624,logoutMin:1148},
  {date:"2026-02-18",name:"Adesh",ext:"0342",loginTime:"10:31 AM",logoutTime:"07:08 PM",loginDur:"08:31:29",outCalls:275,outTT:"02:46:09",manCalls:0,manTT:"00:00:00",totalTT:"02:46:09",autoIdle:"02:41:07",manualIdle:"00:01:13",breakTime:"01:15:46",wrapup:"01:47:14",loginMin:631,logoutMin:1148},
  {date:"2026-02-19",name:"Adesh",ext:"0342",loginTime:"10:22 AM",logoutTime:"07:04 PM",loginDur:"08:39:09",outCalls:377,outTT:"02:28:37",manCalls:0,manTT:"00:00:00",totalTT:"02:28:37",autoIdle:"03:16:04",manualIdle:"00:00:00",breakTime:"01:43:21",wrapup:"01:11:11",loginMin:622,logoutMin:1144},
  {date:"2026-02-20",name:"Adesh",ext:"0342",loginTime:"10:24 AM",logoutTime:"07:10 PM",loginDur:"08:45:57",outCalls:386,outTT:"02:04:24",manCalls:2,manTT:"00:00:00",totalTT:"02:04:24",autoIdle:"03:56:32",manualIdle:"00:01:26",breakTime:"01:56:16",wrapup:"00:47:23",loginMin:624,logoutMin:1150},
  // lovely — 5 days
  {date:"2026-02-16",name:"lovely",ext:"0341",loginTime:"10:27 AM",logoutTime:"07:04 PM",loginDur:"08:24:04",outCalls:295,outTT:"01:36:27",manCalls:5,manTT:"00:29:30",totalTT:"02:05:57",autoIdle:"01:45:37",manualIdle:"00:48:00",breakTime:"01:53:30",wrapup:"01:51:03",loginMin:627,logoutMin:1144},
  {date:"2026-02-17",name:"lovely",ext:"0341",loginTime:"10:27 AM",logoutTime:"07:07 PM",loginDur:"08:18:33",outCalls:271,outTT:"02:16:33",manCalls:0,manTT:"00:00:00",totalTT:"02:16:33",autoIdle:"02:34:10",manualIdle:"00:58:01",breakTime:"01:01:14",wrapup:"01:25:00",loginMin:627,logoutMin:1147},
  {date:"2026-02-18",name:"lovely",ext:"0341",loginTime:"10:28 AM",logoutTime:"07:06 PM",loginDur:"08:37:31",outCalls:328,outTT:"02:24:10",manCalls:0,manTT:"00:00:00",totalTT:"02:24:10",autoIdle:"02:53:16",manualIdle:"00:13:25",breakTime:"01:24:11",wrapup:"01:42:29",loginMin:628,logoutMin:1146},
  {date:"2026-02-19",name:"lovely",ext:"0341",loginTime:"10:28 AM",logoutTime:"07:04 PM",loginDur:"08:36:19",outCalls:310,outTT:"02:03:18",manCalls:0,manTT:"00:00:00",totalTT:"02:03:18",autoIdle:"02:17:32",manualIdle:"01:03:06",breakTime:"01:36:58",wrapup:"01:35:35",loginMin:628,logoutMin:1144},
  {date:"2026-02-20",name:"lovely",ext:"0341",loginTime:"10:25 AM",logoutTime:"07:05 PM",loginDur:"08:37:19",outCalls:385,outTT:"02:06:00",manCalls:1,manTT:"00:00:00",totalTT:"02:06:00",autoIdle:"03:52:40",manualIdle:"00:17:56",breakTime:"01:18:24",wrapup:"01:02:30",loginMin:625,logoutMin:1145},
  // Mansi — 5 days
  {date:"2026-02-16",name:"Mansi",ext:"0334",loginTime:"10:31 AM",logoutTime:"07:16 PM",loginDur:"08:40:26",outCalls:357,outTT:"01:44:29",manCalls:0,manTT:"00:00:00",totalTT:"01:44:29",autoIdle:"02:13:29",manualIdle:"00:00:09",breakTime:"02:24:41",wrapup:"02:17:42",loginMin:631,logoutMin:1156},
  {date:"2026-02-17",name:"Mansi",ext:"0334",loginTime:"10:30 AM",logoutTime:"07:20 PM",loginDur:"08:47:16",outCalls:290,outTT:"01:42:39",manCalls:0,manTT:"00:00:00",totalTT:"01:42:39",autoIdle:"02:35:26",manualIdle:"00:00:00",breakTime:"02:03:51",wrapup:"02:08:44",loginMin:630,logoutMin:1160},
  {date:"2026-02-18",name:"Mansi",ext:"0334",loginTime:"10:32 AM",logoutTime:"07:11 PM",loginDur:"08:33:28",outCalls:321,outTT:"02:10:43",manCalls:3,manTT:"00:00:00",totalTT:"02:10:43",autoIdle:"02:46:29",manualIdle:"00:02:13",breakTime:"01:44:30",wrapup:"01:49:34",loginMin:632,logoutMin:1151},
  {date:"2026-02-19",name:"Mansi",ext:"0334",loginTime:"10:23 AM",logoutTime:"07:00 PM",loginDur:"08:34:27",outCalls:225,outTT:"01:32:35",manCalls:10,manTT:"01:32:48",totalTT:"03:05:23",autoIdle:"01:33:09",manualIdle:"00:07:33",breakTime:"01:29:54",wrapup:"02:18:35",loginMin:623,logoutMin:1200},
  {date:"2026-02-20",name:"Mansi",ext:"0334",loginTime:"11:04 AM",logoutTime:"07:16 PM",loginDur:"08:02:31",outCalls:191,outTT:"01:22:01",manCalls:2,manTT:"01:01:47",totalTT:"02:23:48",autoIdle:"02:22:01",manualIdle:"00:01:53",breakTime:"01:34:43",wrapup:"01:40:11",loginMin:664,logoutMin:1156},
  // Shraddha — 5 days
  {date:"2026-02-16",name:"Shraddha",ext:"0333",loginTime:"10:31 AM",logoutTime:"07:10 PM",loginDur:"08:33:21",outCalls:518,outTT:"02:23:11",manCalls:0,manTT:"00:00:00",totalTT:"02:23:11",autoIdle:"03:30:38",manualIdle:"00:00:00",breakTime:"01:14:57",wrapup:"01:24:42",loginMin:631,logoutMin:1150},
  {date:"2026-02-17",name:"Shraddha",ext:"0333",loginTime:"10:31 AM",logoutTime:"07:18 PM",loginDur:"08:47:02",outCalls:342,outTT:"01:52:41",manCalls:6,manTT:"00:22:43",totalTT:"02:15:24",autoIdle:"03:33:10",manualIdle:"00:01:31",breakTime:"01:48:03",wrapup:"01:08:39",loginMin:631,logoutMin:1158},
  {date:"2026-02-18",name:"Shraddha",ext:"0333",loginTime:"10:19 AM",logoutTime:"07:01 PM",loginDur:"08:26:13",outCalls:229,outTT:"01:56:01",manCalls:2,manTT:"01:58:07",totalTT:"03:54:08",autoIdle:"02:11:11",manualIdle:"00:00:57",breakTime:"01:23:33",wrapup:"00:54:39",loginMin:619,logoutMin:1141},
  {date:"2026-02-19",name:"Shraddha",ext:"0333",loginTime:"10:24 AM",logoutTime:"07:01 PM",loginDur:"08:35:11",outCalls:335,outTT:"02:09:21",manCalls:1,manTT:"00:46:11",totalTT:"02:55:32",autoIdle:"02:38:39",manualIdle:"00:00:30",breakTime:"01:29:25",wrapup:"01:31:07",loginMin:624,logoutMin:1141},
  {date:"2026-02-20",name:"Shraddha",ext:"0333",loginTime:"10:26 AM",logoutTime:"07:02 PM",loginDur:"08:15:11",outCalls:231,outTT:"01:39:27",manCalls:6,manTT:"00:19:04",totalTT:"01:58:31",autoIdle:"02:14:56",manualIdle:"00:09:09",breakTime:"02:24:08",wrapup:"01:28:24",loginMin:626,logoutMin:1142},
  // harsh — 4 days
  {date:"2026-02-16",name:"harsh",ext:"0311",loginTime:"10:32 AM",logoutTime:"07:00 PM",loginDur:"08:03:50",outCalls:483,outTT:"01:31:54",manCalls:0,manTT:"00:00:00",totalTT:"01:31:54",autoIdle:"03:08:36",manualIdle:"00:00:00",breakTime:"02:36:03",wrapup:"00:47:30",loginMin:632,logoutMin:1200},
  {date:"2026-02-18",name:"harsh",ext:"0311",loginTime:"10:24 AM",logoutTime:"07:11 PM",loginDur:"08:36:46",outCalls:306,outTT:"01:51:55",manCalls:0,manTT:"00:00:00",totalTT:"01:51:55",autoIdle:"02:49:50",manualIdle:"00:00:00",breakTime:"02:24:22",wrapup:"00:54:58",loginMin:624,logoutMin:1151},
  {date:"2026-02-19",name:"harsh",ext:"0311",loginTime:"10:21 AM",logoutTime:"07:01 PM",loginDur:"07:59:07",outCalls:315,outTT:"01:38:34",manCalls:1,manTT:"00:00:00",totalTT:"01:38:34",autoIdle:"02:52:45",manualIdle:"00:00:17",breakTime:"02:46:53",wrapup:"00:37:08",loginMin:621,logoutMin:1141},
  {date:"2026-02-20",name:"harsh",ext:"0311",loginTime:"10:22 AM",logoutTime:"07:00 PM",loginDur:"08:37:07",outCalls:363,outTT:"01:43:16",manCalls:1,manTT:"00:00:48",totalTT:"01:44:04",autoIdle:"03:24:38",manualIdle:"00:00:37",breakTime:"02:40:04",wrapup:"00:47:42",loginMin:622,logoutMin:1200},
  // Hemant — 5 days
  {date:"2026-02-16",name:"Hemant",ext:"0340",loginTime:"02:48 PM",logoutTime:"07:08 PM",loginDur:"04:20:19",outCalls:263,outTT:"01:38:09",manCalls:0,manTT:"00:00:00",totalTT:"01:38:09",autoIdle:"01:50:13",manualIdle:"00:00:44",breakTime:"00:35:01",wrapup:"00:16:17",loginMin:888,logoutMin:1148},
  {date:"2026-02-17",name:"Hemant",ext:"0340",loginTime:"10:24 AM",logoutTime:"07:07 PM",loginDur:"08:42:47",outCalls:351,outTT:"02:02:05",manCalls:0,manTT:"00:00:00",totalTT:"02:02:05",autoIdle:"03:20:41",manualIdle:"00:02:58",breakTime:"01:16:40",wrapup:"02:00:24",loginMin:624,logoutMin:1147},
  {date:"2026-02-18",name:"Hemant",ext:"0340",loginTime:"10:24 AM",logoutTime:"07:08 PM",loginDur:"08:39:33",outCalls:387,outTT:"02:34:21",manCalls:0,manTT:"00:00:00",totalTT:"02:34:21",autoIdle:"03:37:50",manualIdle:"00:00:00",breakTime:"00:58:13",wrapup:"01:29:09",loginMin:624,logoutMin:1148},
  {date:"2026-02-19",name:"Hemant",ext:"0340",loginTime:"10:24 AM",logoutTime:"07:04 PM",loginDur:"08:40:31",outCalls:394,outTT:"02:25:14",manCalls:0,manTT:"00:00:00",totalTT:"02:25:14",autoIdle:"03:22:35",manualIdle:"00:00:00",breakTime:"01:18:42",wrapup:"01:49:08",loginMin:624,logoutMin:1144},
  {date:"2026-02-20",name:"Hemant",ext:"0340",loginTime:"10:24 AM",logoutTime:"07:05 PM",loginDur:"08:31:48",outCalls:389,outTT:"02:01:18",manCalls:1,manTT:"00:00:00",totalTT:"02:01:18",autoIdle:"03:31:28",manualIdle:"00:01:29",breakTime:"00:59:40",wrapup:"01:57:55",loginMin:624,logoutMin:1145},
  // saksham — 5 days
  {date:"2026-02-16",name:"saksham",ext:"0327",loginTime:"10:34 AM",logoutTime:"07:07 PM",loginDur:"08:32:48",outCalls:199,outTT:"01:39:46",manCalls:8,manTT:"00:17:45",totalTT:"02:01:26",autoIdle:"01:13:30",manualIdle:"00:50:07",breakTime:"01:44:50",wrapup:"02:43:05",loginMin:634,logoutMin:1147},
  {date:"2026-02-17",name:"saksham",ext:"0327",loginTime:"10:42 AM",logoutTime:"07:21 PM",loginDur:"08:20:43",outCalls:194,outTT:"02:03:04",manCalls:4,manTT:"00:00:46",totalTT:"02:06:17",autoIdle:"01:53:25",manualIdle:"02:20:31",breakTime:"00:47:19",wrapup:"01:13:30",loginMin:642,logoutMin:1161},
  {date:"2026-02-18",name:"saksham",ext:"0327",loginTime:"10:34 AM",logoutTime:"07:01 PM",loginDur:"08:26:47",outCalls:213,outTT:"02:30:42",manCalls:4,manTT:"00:00:14",totalTT:"02:34:18",autoIdle:"01:45:41",manualIdle:"00:31:03",breakTime:"01:26:26",wrapup:"02:09:23",loginMin:634,logoutMin:1141},
  {date:"2026-02-19",name:"saksham",ext:"0327",loginTime:"11:47 AM",logoutTime:"07:43 PM",loginDur:"07:50:25",outCalls:226,outTT:"01:56:42",manCalls:5,manTT:"00:12:41",totalTT:"02:17:30",autoIdle:"01:46:35",manualIdle:"00:17:50",breakTime:"02:09:56",wrapup:"01:18:24",loginMin:707,logoutMin:1183},
  {date:"2026-02-20",name:"saksham",ext:"0327",loginTime:"10:38 AM",logoutTime:"07:06 PM",loginDur:"08:28:08",outCalls:193,outTT:"02:29:36",manCalls:5,manTT:"00:01:28",totalTT:"02:33:32",autoIdle:"01:47:30",manualIdle:"00:30:36",breakTime:"01:55:56",wrapup:"01:40:35",loginMin:638,logoutMin:1146},
  // BHAWANA SHARMA — 5 days
  {date:"2026-02-16",name:"BHAWANA SHARMA",ext:"0238",loginTime:"10:48 AM",logoutTime:"07:02 PM",loginDur:"06:54:46",outCalls:73,outTT:"00:31:33",manCalls:0,manTT:"00:00:00",totalTT:"00:31:33",autoIdle:"00:25:35",manualIdle:"00:20:05",breakTime:"03:52:03",wrapup:"01:45:28",loginMin:648,logoutMin:1142},
  {date:"2026-02-17",name:"BHAWANA SHARMA",ext:"0238",loginTime:"12:02 PM",logoutTime:"06:59 PM",loginDur:"04:33:42",outCalls:24,outTT:"00:08:19",manCalls:3,manTT:"00:20:43",totalTT:"00:29:02",autoIdle:"00:11:27",manualIdle:"00:36:01",breakTime:"02:03:52",wrapup:"01:13:51",loginMin:722,logoutMin:1139},
  {date:"2026-02-18",name:"BHAWANA SHARMA",ext:"0238",loginTime:"10:41 AM",logoutTime:"07:04 PM",loginDur:"06:34:19",outCalls:76,outTT:"00:21:50",manCalls:0,manTT:"00:00:00",totalTT:"00:21:50",autoIdle:"00:30:45",manualIdle:"00:40:50",breakTime:"03:55:11",wrapup:"01:05:43",loginMin:641,logoutMin:1144},
  {date:"2026-02-19",name:"BHAWANA SHARMA",ext:"0238",loginTime:"10:32 AM",logoutTime:"07:01 PM",loginDur:"07:49:18",outCalls:130,outTT:"00:31:49",manCalls:2,manTT:"00:13:40",totalTT:"00:45:29",autoIdle:"00:53:52",manualIdle:"00:00:46",breakTime:"04:10:52",wrapup:"01:58:19",loginMin:632,logoutMin:1141},
  {date:"2026-02-20",name:"BHAWANA SHARMA",ext:"0238",loginTime:"11:40 AM",logoutTime:"04:33 PM",loginDur:"03:46:51",outCalls:58,outTT:"00:11:55",manCalls:0,manTT:"00:00:00",totalTT:"00:11:55",autoIdle:"00:34:44",manualIdle:"00:00:00",breakTime:"00:59:04",wrapup:"02:01:03",loginMin:700,logoutMin:993},
  // Nishu — 4 days
  {date:"2026-02-16",name:"Nishu",ext:"0227",loginTime:"10:32 AM",logoutTime:"06:53 PM",loginDur:"07:01:37",outCalls:235,outTT:"00:38:01",manCalls:0,manTT:"00:00:00",totalTT:"00:38:01",autoIdle:"01:26:30",manualIdle:"00:21:11",breakTime:"03:38:18",wrapup:"00:57:44",loginMin:632,logoutMin:1133},
  {date:"2026-02-17",name:"Nishu",ext:"0227",loginTime:"10:35 AM",logoutTime:"06:59 PM",loginDur:"04:26:24",outCalls:106,outTT:"00:30:43",manCalls:0,manTT:"00:00:00",totalTT:"00:30:43",autoIdle:"00:43:42",manualIdle:"00:16:27",breakTime:"02:12:55",wrapup:"00:42:38",loginMin:635,logoutMin:1139},
  {date:"2026-02-19",name:"Nishu",ext:"0227",loginTime:"10:33 AM",logoutTime:"05:03 PM",loginDur:"04:26:28",outCalls:57,outTT:"00:26:15",manCalls:2,manTT:"00:04:02",totalTT:"00:30:17",autoIdle:"00:24:14",manualIdle:"00:19:39",breakTime:"03:00:16",wrapup:"00:12:02",loginMin:633,logoutMin:1083},
  {date:"2026-02-20",name:"Nishu",ext:"0227",loginTime:"02:10 PM",logoutTime:"06:43 PM",loginDur:"02:42:14",outCalls:40,outTT:"00:17:12",manCalls:0,manTT:"00:00:00",totalTT:"00:17:12",autoIdle:"00:19:08",manualIdle:"00:00:00",breakTime:"01:36:11",wrapup:"00:29:45",loginMin:850,logoutMin:1123},
  // harshul — 4 days
  {date:"2026-02-17",name:"harshul",ext:"0347",loginTime:"11:06 AM",logoutTime:"05:05 PM",loginDur:"05:49:44",outCalls:82,outTT:"00:34:14",manCalls:0,manTT:"00:00:00",totalTT:"00:34:14",autoIdle:"00:44:53",manualIdle:"01:40:02",breakTime:"02:10:56",wrapup:"00:39:39",loginMin:666,logoutMin:1065},
  {date:"2026-02-18",name:"harshul",ext:"0347",loginTime:"11:13 AM",logoutTime:"06:00 PM",loginDur:"05:03:47",outCalls:61,outTT:"00:26:38",manCalls:1,manTT:"00:00:03",totalTT:"00:26:41",autoIdle:"00:36:47",manualIdle:"02:17:11",breakTime:"01:32:48",wrapup:"00:10:20",loginMin:673,logoutMin:1120},
  {date:"2026-02-19",name:"harshul",ext:"0347",loginTime:"03:10 PM",logoutTime:"06:03 PM",loginDur:"02:52:47",outCalls:43,outTT:"00:13:59",manCalls:0,manTT:"00:00:00",totalTT:"00:13:59",autoIdle:"00:17:24",manualIdle:"01:13:32",breakTime:"00:43:58",wrapup:"00:23:58",loginMin:910,logoutMin:1083},
  {date:"2026-02-20",name:"harshul",ext:"0347",loginTime:"11:17 AM",logoutTime:"06:40 PM",loginDur:"07:22:52",outCalls:96,outTT:"00:42:30",manCalls:0,manTT:"00:00:00",totalTT:"00:42:30",autoIdle:"00:48:46",manualIdle:"03:12:24",breakTime:"01:19:58",wrapup:"01:19:14",loginMin:677,logoutMin:1120},
];

// ── Constants ──────────────────────────────────────────────────────────────────
export const LATE_MIN = 630;
export const EARLY_MIN = 1140;
export const MAX_BRK_SEC = 60 * 60;
export const MAX_WU_SEC = 10;
const SHIFT_SEC = 8.5 * 3600;

// ── Permanent agent serial numbers (first-appearance order) ───────────────────
export const AGENT_SN = (() => {
    const map = {};
    let n = 1;
    ALL_AGENTS.forEach(a => { if (map[a.ext] === undefined) map[a.ext] = n++; });
    return map;
})();

// ── Utility functions ──────────────────────────────────────────────────────────
export function toSec(t) {
    if (!t) return 0;
    const p = t.split(':');
    return +p[0] * 3600 + +p[1] * 60 + +p[2];
}

export function hms(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sc = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
}

export function hmShort(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

export function fmtDate(d) {
    if (!d) return '—';
    const [y, mo, dy] = d.split('-');
    const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${parseInt(dy)} ${mn[parseInt(mo) - 1]} ${y}`;
}

// ── Process a single agent record into display-ready fields ───────────────────
export function proc(a) {
    const tc = a.outCalls + a.manCalls;
    const isLate = a.loginMin > LATE_MIN, isEarly = a.logoutMin < EARLY_MIN;
    const ldSec = toSec(a.loginDur), brkSec = toSec(a.breakTime), miSec = toSec(a.manualIdle);
    const wuSec = toSec(a.wrapup), outTTs = toSec(a.outTT), manTTs = toSec(a.manTT), ttSec = toSec(a.totalTT);
    const avgWu = tc > 0 ? Math.round(wuSec / tc) : 0;
    const miBad = miSec > 0, brkBad = brkSec > MAX_BRK_SEC, wuBad = avgWu > MAX_WU_SEC;
    const ttBad = outTTs > 0 && manTTs >= outTTs * 0.4;
    const sessOk = !isLate && !isEarly;
    const lateWaste = isLate ? (a.loginMin - LATE_MIN) * 60 : 0;
    const earlyWaste = isEarly ? (EARLY_MIN - a.logoutMin) * 60 : 0;
    const miWaste = miSec, wuWaste = Math.max(0, wuSec - MAX_WU_SEC * tc);
    const brkWaste = Math.max(0, brkSec - MAX_BRK_SEC);
    const wasteSec = lateWaste + earlyWaste + miWaste + wuWaste + brkWaste;
    const wastePct = Math.round(wasteSec / SHIFT_SEC * 100);
    const lateMins = a.loginMin - LATE_MIN, earlyMins = EARLY_MIN - a.logoutMin;
    return {
        ...a, tc, isLate, isEarly, ldSec, brkSec, miSec, wuSec, outTTs, manTTs, ttSec, avgWu,
        miBad, brkBad, wuBad, ttBad, sessOk, wasteSec, wastePct,
        lateWaste, earlyWaste, miWaste, wuWaste, brkWaste, lateMins, earlyMins
    };
}
