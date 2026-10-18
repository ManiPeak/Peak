/**
 * فهرست توانایی‌های ربات ماینکرفت — ۱۲۸+ کار دسته‌بندی‌شده
 *
 * هر توانایی: شناسه، عنوان فارسی، دسته، نیاز به OP، توضیح، نمونه جمله‌های فارسی.
 * اجرا: یا از طریق API داخلی ربات (api)، یا دستور اسلش سرور (op).
 */
import type { PlayLevel } from "@/lib/types";

export type CapCategory =
  | "movement"
  | "world"
  | "player"
  | "build"
  | "combat"
  | "gather"
  | "info"
  | "chat"
  | "fun"
  | "modes";

export interface Capability {
  id: string;
  label: string;
  cat: CapCategory;
  op: boolean;
  desc: string;
  /** نمونه جمله‌های فارسی برای مچ سریع */
  samples: string[];
  /** نحوهٔ اجرا */
  kind: "api" | "op" | "info";
  /** برای kind=op: الگوی دستور اسلش با {self} {player} {item} {n} {x} {y} {z} */
  template?: string;
  /** سطح بازی لازم (تنظیمات mcPlayLevel) — مثل مهروموم خدایی که فقط در سطح «خدا» در دسترس است */
  level?: PlayLevel;
  /** توضیح انگلیسی (اختیاری) — نمایش دوزبانه در فهرست توانایی‌ها */
  descEn?: string;
}

export const CAP_CATEGORIES: { id: CapCategory; label: string }[] = [
  { id: "movement", label: "🏃 حرکت و رفتار" },
  { id: "world", label: "🌍 جهان، زمان و هوا" },
  { id: "player", label: "🧙 بازیکن و قدرت‌های OP" },
  { id: "build", label: "🧱 ساخت و ساز" },
  { id: "combat", label: "⚔️ نبرد و محافظت" },
  { id: "gather", label: "⛏️ جمع‌آوری و معدن" },
  { id: "info", label: "📊 اطلاعات و گزارش" },
  { id: "chat", label: "💬 ارتباط و چت" },
  { id: "fun", label: "🎉 سرگرمی" },
  { id: "modes", label: "🧠 حالت‌ها و شخصیت" }
];

export const CAPABILITIES: Capability[] = [
  /* ---------- حرکت و رفتار (۱۶) ---------- */
  { id: "follow", label: "دنبال کردن بازیکن", cat: "movement", op: false, desc: "بازیکن را دنبال می‌کند", kind: "api", samples: ["بیا دنبالم", "منو دنبال کن", "follow me"] },
  { id: "come", label: "آمدن پیش بازیکن", cat: "movement", op: false, desc: "تا نزدیکی بازیکن می‌آید", kind: "api", samples: ["بیا پیشم", "بیا اینجا", "come here"] },
  { id: "stop", label: "توقف کامل", cat: "movement", op: false, desc: "هر حرکتی را متوقف می‌کند", kind: "api", samples: ["وایسا", "توقف", "stop"] },
  { id: "goto", label: "رفتن به مختصات", cat: "movement", op: false, desc: "تا مختصات مشخص می‌رود", kind: "api", samples: ["برو به 100 64 200"] },
  { id: "go_back", label: "برگشت به جای قبلی", cat: "movement", op: false, desc: "به جایی که قبلاً بوده برمی‌گردد (با هر «برگرد» یک جای عقب‌تر)", kind: "api", samples: ["برگرد", "برگرد جای قبلی", "بیا برگرد", "bargard"] },
  { id: "mark_here", label: "یاد کردن این مکان", cat: "movement", op: false, desc: "این مکان را یاد می‌کند تا بعداً برگردد", kind: "api", samples: ["اینجا رو یاد کن", "این مکان رو یاد کن", "save spot"] },
  { id: "jump", label: "پریدن", cat: "movement", op: false, desc: "یک پرش می‌کند", kind: "api", samples: ["بپر", "jump"] },
  { id: "sprint", label: "دویدن (موشکی)", cat: "movement", op: false, desc: "اسپرینت+پرش مثل موشک 🚀", kind: "api", samples: ["حالت موشک", "عین موشک بدو"] },
  { id: "look_at", label: "نگاه کردن به بازیکن", cat: "movement", op: false, desc: "رو به بازیکن می‌چرخد", kind: "api", samples: ["نگام کن", "look at me"] },
  { id: "crouch", label: "نشستن", cat: "movement", op: false, desc: "اسنیک می‌کند", kind: "api", samples: ["بشین", "sneak"] },
  { id: "swim", label: "شنا کردن", cat: "movement", op: false, desc: "در آب شنا می‌کند", kind: "api", samples: ["شنا کن"] },
  { id: "patrol", label: "گشت‌زنی", cat: "movement", op: false, desc: "دور بازیکن گشت می‌زند", kind: "api", samples: ["گشت بزن", "پاترول کن"] },
  { id: "circle", label: "دور زدن دور بازیکن", cat: "movement", op: false, desc: "دایره‌ای دور بازیکن حرکت می‌کند", kind: "api", samples: ["دورم بچرخ"] },
  { id: "jump_party", label: "پرش‌های متوالی", cat: "movement", op: false, desc: "چند بار پشت سر هم می‌پرد", kind: "api", samples: ["زنجیره بپر"] },
  { id: "back", label: "عقب رفتن", cat: "movement", op: false, desc: "چند قدم عقب می‌رود", kind: "api", samples: ["برو عقب"] },
  { id: "left", label: "رفتن چپ", cat: "movement", op: false, desc: "به چپ می‌رود", kind: "api", samples: ["برو چپ"] },
  { id: "right", label: "رفتن راست", cat: "movement", op: false, desc: "به راست می‌رود", kind: "api", samples: ["برو راست"] },
  { id: "bridge_walk", label: "پل ساختن هنگام راه رفتن", cat: "movement", op: false, desc: "زیر پایش بلوک می‌گذارد", kind: "api", samples: ["پل بساز"] },

  /* ---------- جهان، زمان و هوا (۱۴) — اکثراً OP ---------- */
  { id: "time_day", label: "روز کردن", cat: "world", op: true, desc: "زمان را روز می‌کند", kind: "op", template: "time set day", samples: ["روز کن", "صبحش کن"] },
  { id: "time_night", label: "شب کردن", cat: "world", op: true, desc: "زمان را شب می‌کند", kind: "op", template: "time set night", samples: ["شب کن", "تاریکش کن"] },
  { id: "time_noon", label: "نصف‌النهار", cat: "world", op: true, desc: "زمان را وسط روز می‌کند", kind: "op", template: "time set noon", samples: ["وسط روز کن"] },
  { id: "time_midnight", label: "نیمه‌شب", cat: "world", op: true, desc: "زمان را نیمه‌شب می‌کند", kind: "op", template: "time set midnight", samples: ["نیمه شب کن"] },
  { id: "weather_clear", label: "هوا صاف", cat: "world", op: true, desc: "باران و رعد را قطع می‌کند", kind: "op", template: "weather clear", samples: ["هوا صاف", "بارون بند"] },
  { id: "weather_rain", label: "باران", cat: "world", op: true, desc: "باران می‌بارد", kind: "op", template: "weather rain", samples: ["بارون بیار"] },
  { id: "weather_thunder", label: "طوفان", cat: "world", op: true, desc: "طوفان و رعدوبرق", kind: "op", template: "weather thunder", samples: ["طوفان بیار", "رعد و برق"] },
  { id: "difficulty_peaceful", label: "درجهٔ آسان", cat: "world", op: true, desc: "سختی صلح‌آمیز", kind: "op", template: "difficulty peaceful", samples: ["آسونش کن"] },
  { id: "difficulty_hard", label: "درجهٔ سخت", cat: "world", op: true, desc: "سختی دشوار", kind: "op", template: "difficulty hard", samples: ["سختش کن"] },
  { id: "difficulty_normal", label: "درجهٔ عادی", cat: "world", op: true, desc: "سختی معمولی", kind: "op", template: "difficulty normal", samples: ["عادیش کن"] },
  { id: "gamerule_keep", label: "حفظ آیتم‌ها بعد از مرگ", cat: "world", op: true, desc: "آیتم‌ها نمی‌افتند", kind: "op", template: "gamerule keepInventory true", samples: ["آیتما نیفتن"] },
  { id: "gamerule_daylight", label: "توقف چرخهٔ روز و شب", cat: "world", op: true, desc: "خورشید ثابت می‌ماند", kind: "op", template: "gamerule doDaylightCycle false", samples: ["روز ثابت بمونه"] },
  { id: "spawnpoint", label: "نقطهٔ اسپاون", cat: "world", op: true, desc: "اسپاون را روی بازیکن می‌گذارد", kind: "op", template: "spawnpoint {player}", samples: ["اسپاون رو من بذار"] },
  { id: "set_worldspawn", label: "اسپاون جهان", cat: "world", op: true, desc: "اسپاون جهان را تغییر می‌دهد", kind: "op", template: "setworldspawn {x} {y} {z}", samples: ["اسپاون جهان اینجا باشه"] },

  /* ---------- بازیکن و قدرت‌های OP (۲۸) ---------- */
  { id: "tp_to_me", label: "تلپورت به بازیکن", cat: "player", op: true, desc: "خودش را پیش بازیکن تلپورت می‌کند ⚡", kind: "op", template: "tp {self} {player}", samples: ["بیا پیش من", "تلپورت کن پیش من", "tp بیا پیشم"] },
  { id: "tp_player_to_me", label: "آوردن بازیکن", cat: "player", op: true, desc: "بازیکن دیگر را می‌آورد", kind: "op", template: "tp {player} {self}", samples: ["فلانی رو بیار پیشم"] },
  { id: "tp_coords", label: "تلپورت به مختصات", cat: "player", op: true, desc: "تلپورت به xyz", kind: "op", template: "tp {self} {x} {y} {z}", samples: ["تلپورت به 100 64 200"] },
  { id: "tp_up", label: "تلپورت به بالا", cat: "player", op: true, desc: "به آسمان می‌رود", kind: "op", template: "tp {self} {x} {y} {z}", samples: ["ببر بالا", "برو آسمون"] },
  { id: "gamemode_creative", label: "حالت خلاقانه", cat: "player", op: true, desc: "گیم‌مود کریتیو", kind: "op", template: "gamemode creative {self}", samples: ["خلاقانه شو", "کریتیو"] },
  { id: "gamemode_survival", label: "حالت بقا", cat: "player", op: true, desc: "گیم‌مود سروایول", kind: "op", template: "gamemode survival {self}", samples: ["بقا شو", "سروایول"] },
  { id: "gamemode_adventure", label: "حالت ماجراجویی", cat: "player", op: true, desc: "گیم‌مود ادونچر", kind: "op", template: "gamemode adventure {self}", samples: ["ماجراجویی"] },
  { id: "gamemode_spectator", label: "حالت تماشاگر", cat: "player", op: true, desc: "گیم‌مود اسپکتیتور", kind: "op", template: "gamemode spectator {self}", samples: ["تماشاگر شو"] },
  { id: "give_item", label: "دادن آیتم", cat: "player", op: true, desc: "آیتم به بازیکن می‌دهد", kind: "op", template: "give {player} {item} {n}", samples: ["بهم شمشیر بده", "یه الماس بده"] },
  { id: "give_self_item", label: "گرفتن آیتم برای خودش", cat: "player", op: true, desc: "آیتم به خودش می‌دهد", kind: "op", template: "give {self} {item} {n}", samples: ["برای خودت بلوک بگیر"] },
  { id: "effect_speed", label: "افکت سرعت", cat: "player", op: true, desc: "سرعت بالا", kind: "op", template: "effect give {self} speed 300 3", samples: ["سریع شو", "افکت سرعت"] },
  { id: "effect_jump", label: "افکت پرش", cat: "player", op: true, desc: "پرش بلند", kind: "op", template: "effect give {self} jump_boost 300 5", samples: ["پرش بالا"] },
  { id: "effect_strength", label: "افکت قدرت", cat: "player", op: true, desc: "ضربهٔ قوی", kind: "op", template: "effect give {self} strength 300 3", samples: ["قوی شو"] },
  { id: "effect_regen", label: "افکت بازیابی جان", cat: "player", op: true, desc: "سلامت سریع", kind: "op", template: "effect give {self} regeneration 300 2", samples: ["سلامتی بگیر"] },
  { id: "effect_fire", label: "مقاومت در برابر آتش", cat: "player", op: true, desc: "نمی‌سوزد", kind: "op", template: "effect give {self} fire_resistance 300", samples: ["آتیش نگیر"] },
  { id: "effect_night", label: "دید در شب", cat: "player", op: true, desc: "افکت دید شب", kind: "op", template: "effect give {self} night_vision 300", samples: ["دید در شب"] },
  { id: "effect_water", label: "تنفس زیر آب", cat: "player", op: true, desc: "افکت تنفس", kind: "op", template: "effect give {self} water_breathing 300", samples: ["زیر آب نفس بکش"] },
  { id: "clear_effects", label: "پاک کردن افکت‌ها", cat: "player", op: true, desc: "همهٔ افکت‌ها پاک می‌شوند", kind: "op", template: "effect clear {self}", samples: ["افکتا رو پاک کن"] },
  { id: "heal", label: "پر کردن جان", cat: "player", op: true, desc: "جان کامل", kind: "op", template: "effect give {self} instant_health 1 10", samples: ["سلامتیم رو پر کن", "هیلم"] },
  { id: "feed", label: "سیر کردن", cat: "player", op: true, desc: "گرسنگی را پر می‌کند", kind: "op", template: "effect give {self} saturation 1 10", samples: ["گشنمه", "سیرم کن"] },
  { id: "xp_levels", label: "دادن لول XP", cat: "player", op: true, desc: "تجربه اضافه می‌کند", kind: "op", template: "xp add {player} {n} levels", samples: ["۱۰ لول بده"] },
  { id: "enchant", label: "جادوی ابزار", cat: "player", op: true, desc: "ابزار دستش را جادو می‌کند", kind: "op", template: "enchant {self} sharpness 5", samples: ["شمشیرم رو جادو کن"] },
  { id: "kill_mobs", label: "کشتن ماب‌های اطراف", cat: "player", op: true, desc: "ماب‌های خصم را پاک می‌کند", kind: "op", template: "kill @e[type=!player,distance=..30]", samples: ["مابا رو بکش", "اینا رو پاک کن"] },
  { id: "clear_inventory", label: "خالی کردن کوله", cat: "player", op: true, desc: "کوله خالی می‌شود", kind: "op", template: "clear {self}", samples: ["کولم رو خالی کن"] },
  { id: "fly", label: "پرواز", cat: "player", op: true, desc: "با کریتیو پرواز می‌کند", kind: "op", template: "gamemode creative {self}", samples: ["پرواز کن"] },
  { id: "op_self", label: "OP کردن خودش", cat: "player", op: true, desc: "خودش را OP می‌کند", kind: "op", template: "op {self}", samples: ["خودت op شو"] },
  { id: "say_server", label: "اعلان سرور", cat: "player", op: true, desc: "پیام رسمی سرور", kind: "op", template: "say {item}", samples: ["اعلان بده"] },

  /* ---------- ساخت و ساز (۱۲) ---------- */
  { id: "place_block", label: "گذاشتن بلوک", cat: "build", op: false, desc: "جلوی پایش بلوک می‌گذارد", kind: "api", samples: ["اینجا بلوک بذار"] },
  { id: "build_tower", label: "ساخت برج", cat: "build", op: true, desc: "ستون بلوک می‌سازد", kind: "op", template: "fill {x} {y} {z} {x} {y+12} {z} stone", samples: ["برج بساز"] },
  { id: "build_wall", label: "ساخت دیوار", cat: "build", op: true, desc: "دیوار سنگی", kind: "op", template: "fill {x-6} {y} {z} {x+6} {y+4} {z} stone", samples: ["دیوار بساز"] },
  { id: "build_cube", label: "ساخت مکعب", cat: "build", op: true, desc: "مکعب توخالی", kind: "op", template: "fill {x-3} {y} {z-3} {x+3} {y+6} {z+3} quartz_block hollow", samples: ["مکعب بساز"] },
  { id: "build_platform", label: "ساخت سکو", cat: "build", op: true, desc: "سکوی زیر پا", kind: "op", template: "fill {x-5} {y-1} {z-5} {x+5} {y-1} {z+5} glass", samples: ["سکو بساز"] },
  { id: "clear_area", label: "خالی کردن محوطه", cat: "build", op: true, desc: "منطقه را صاف می‌کند", kind: "op", template: "fill {x-8} {y} {z-8} {x+8} {y+10} {z+8} air", samples: ["اینجا رو خالی کن"] },
  { id: "setblock", label: "گذاشتن بلوک خاص", cat: "build", op: true, desc: "بلوک مشخص در مختصات", kind: "op", template: "setblock {x} {y} {z} {item}", samples: ["اینجا الماس بذار"] },
  { id: "clone_area", label: "کپی سازه", cat: "build", op: true, desc: "منطقه را کپی می‌کند", kind: "op", template: "clone {x-4} {y} {z-4} {x+4} {y+8} {z+4} {x+4} {y} {z+4}", samples: ["این سازه رو کپی کن"] },
  { id: "dig_down", label: "حفاری به پایین", cat: "build", op: false, desc: "چاله می‌کند", kind: "api", samples: ["اینجا رو بکن"] },
  { id: "dig_stairs", label: "ساخت پله", cat: "build", op: false, desc: "پله به پایین می‌کند", kind: "api", samples: ["پله بکن"] },
  { id: "house", label: "ساخت خانهٔ ساده", cat: "build", op: true, desc: "خانهٔ کوچک چوبی توخالی", kind: "op", template: "fill {x-3} {y} {z-3} {x+3} {y+5} {z+3} oak_planks hollow", samples: ["خونه بساز"] },
  { id: "torch_line", label: "ردیف مشعل", cat: "build", op: true, desc: "مشعل‌ها را ردیف می‌گذارد", kind: "op", template: "fill {x} {y} {z} {x+12} {y} {z} torch", samples: ["ردیف مشعل"] },

  /* ---------- نبرد و محافظت (۱۲) ---------- */
  { id: "guard_on", label: "روشن کردن محافظت", cat: "combat", op: false, desc: "محافظت پلیسی 🛡️", kind: "api", samples: ["محافظت کن", "حالت پلیس"] },
  { id: "guard_off", label: "خاموش کردن محافظت", cat: "combat", op: false, desc: "محافظت خاموش", kind: "api", samples: ["محافظت خاموش"] },
  { id: "autoattack_on", label: "حملهٔ خودکار", cat: "combat", op: false, desc: "اتوکلیک ⚔️", kind: "api", samples: ["اتوکلیک", "حمله خودکار"] },
  { id: "autoattack_off", label: "توقف حملهٔ خودکار", cat: "combat", op: false, desc: "اتوکلیک خاموش", kind: "api", samples: ["حمله خودکار خاموش"] },
  { id: "attack_nearest", label: "حمله به نزدیک‌ترین", cat: "combat", op: false, desc: "یک ضربه به نزدیک‌ترین دشمن", kind: "api", samples: ["بزن بکشش", "حمله کن"] },
  { id: "attack_player", label: "حمله به بازیکن", cat: "combat", op: false, desc: "به بازیکن مشخص حمله می‌کند", kind: "api", samples: ["به فلانی حمله کن"] },
  { id: "flee", label: "فرار", cat: "combat", op: false, desc: "از دشمن دور می‌شود", kind: "api", samples: ["فرار کن", "در برو"] },
  { id: "shield_up", label: "سپر گرفتن", cat: "combat", op: false, desc: "سپر دست می‌گیرد", kind: "api", samples: ["سپر بگیر"] },
  { id: "bow_shot", label: "تیراندازی", cat: "combat", op: false, desc: "به دشمن تیر می‌زند", kind: "api", samples: ["تیر بزن"] },
  { id: "collect_arrows", label: "جمع‌آوری تیر", cat: "combat", op: false, desc: "تیرها را جمع می‌کند", kind: "api", samples: ["تیرا رو جمع کن"] },
  { id: "kill_all_mobs", label: "پاکسازی ماب‌ها", cat: "combat", op: true, desc: "همهٔ ماب‌های نزدیک", kind: "op", template: "kill @e[type=!player,distance=..50]", samples: ["همه مابا رو بکش"] },
  { id: "respawn", label: "بازگشت به اسپاون", cat: "combat", op: true, desc: "خودش را به اسپاون می‌برد", kind: "op", template: "tp {self} {x} {y} {z}", samples: ["برو اسپاون"] },

  /* ---------- جمع‌آوری و معدن (۱۲) ---------- */
  { id: "collect_block", label: "جمع‌آوری بلوک", cat: "gather", op: false, desc: "بلوک‌های اطراف را جمع می‌کند", kind: "api", samples: ["سنگ جمع کن", "چوب جمع کن"] },
  { id: "collect_all", label: "جمع‌آوری همه‌چیز", cat: "gather", op: false, desc: "هر چه اطرافش هست", kind: "api", samples: ["همه چی رو جمع کن"] },
  { id: "mine_vein", label: "استخراج رگه", cat: "gather", op: false, desc: "رگهٔ معدنی را می‌کند", kind: "api", samples: ["این رگه رو بکن"] },
  { id: "chop_trees", label: "بریدن درخت", cat: "gather", op: false, desc: "درخت‌ها را می‌برد", kind: "api", samples: ["درخت ببر"] },
  { id: "gather_food", label: "جمع‌آوری غذا", cat: "gather", op: false, desc: "غذا و میوه جمع می‌کند", kind: "api", samples: ["غذا جمع کن"] },
  { id: "gather_ore", label: "جمع‌آوری سنگ معدن", cat: "gather", op: false, desc: "سنگ‌های معدنی", kind: "api", samples: ["سنگ معدن جمع کن"] },
  { id: "mine_down", label: "حفاری چاه", cat: "gather", op: false, desc: "تا پایین می‌کند", kind: "api", samples: ["چاه بکن"] },
  { id: "mine_forward", label: "تونل‌زنی", cat: "gather", op: false, desc: "تونل جلو می‌رود", kind: "api", samples: ["تونل بزن"] },
  { id: "pickup_all", label: "برداشتن آیتم‌ها", cat: "gather", op: false, desc: "آیتم‌های زمین را برمی‌دارد", kind: "api", samples: ["آیتما رو بردار"] },
  { id: "drop_junk", label: "انداختن آیتم اضافه", cat: "gather", op: false, desc: "آیتم‌های بی‌مصرف را می‌ریزد", kind: "api", samples: ["زائد رو بنداز"] },
  { id: "sort_inventory", label: "مرتب کردن کوله", cat: "gather", op: false, desc: "کوله را مرتب می‌کند", kind: "api", samples: ["کوله رو مرتب کن"] },
  { id: "farm_harvest", label: "برداشت مزرعه", cat: "gather", op: false, desc: "محصولات مزرعه", kind: "api", samples: ["مزرعه رو بردار"] },

  /* ---------- اطلاعات و گزارش (۱۶) ---------- */
  { id: "status", label: "گزارش کامل", cat: "info", op: false, desc: "وضعیت کامل ربات", kind: "info", samples: ["وضعیت", "گزارش بده"] },
  { id: "coords", label: "مختصات من", cat: "info", op: false, desc: "کجای نقشه است", kind: "info", samples: ["کجایی", "مختصاتت چنده"] },
  { id: "health_report", label: "وضعیت جان و سیری", cat: "info", op: false, desc: "سلامت ربات", kind: "info", samples: ["چند جون داری"] },
  { id: "players_online", label: "بازیکنان آنلاین", cat: "info", op: false, desc: "چه کسی آنلاین است", kind: "info", samples: ["کیا آنلاینن"] },
  { id: "nearest_player", label: "نزدیک‌ترین بازیکن", cat: "info", op: false, desc: "کسی که نزدیک‌تر است", kind: "info", samples: ["کی بهم نزدیکه"] },
  { id: "nearest_mobs", label: "ماب‌های اطراف", cat: "info", op: false, desc: "چه ماب‌هایی نزدیک‌اند", kind: "info", samples: ["مابی این اطراف هست"] },
  { id: "inventory_report", label: "فهرست کوله", cat: "info", op: false, desc: "چه آیتم‌هایی دارد", kind: "info", samples: ["تو کولت چی داری"] },
  { id: "biome_name", label: "بیوم", cat: "info", op: false, desc: "نوع منطقه", kind: "info", samples: ["اینجا چه بیومیه"] },
  { id: "time_report", label: "زمان بازی", cat: "info", op: false, desc: "روز یا شب؟", kind: "info", samples: ["الان روزه یا شب"] },
  { id: "dimension_info", label: "بعد فعلی", cat: "info", op: false, desc: "اورورلد/ندر/اند", kind: "info", samples: ["تو کدوم بعدی"] },
  { id: "block_here", label: "بلوک زیر پا", cat: "info", op: false, desc: "چه بلوکی زیرش است", kind: "info", samples: ["زیر پات چیه"] },
  { id: "light_level", label: "سطح نور", cat: "info", op: false, desc: "نور محیط", kind: "info", samples: ["اینجا چقد تاریکه"] },
  { id: "day_count", label: "تعداد روزها", cat: "info", op: false, desc: "چند روز گذشته", kind: "info", samples: ["چند روزه اینجاییم"] },
  { id: "server_info", label: "اطلاعات سرور", cat: "info", op: false, desc: "آدرس و وضعیت سرور", kind: "info", samples: ["سرور کدومه"] },
  { id: "equipment", label: "ابزار دست", cat: "info", op: false, desc: "چه چیزی در دست دارد", kind: "info", samples: ["دستت چیه"] },
  { id: "danger_scan", label: "اسکن خطر", cat: "info", op: false, desc: "خطرهای اطراف", kind: "info", samples: ["خطری هست", "اسکن کن", "اسکن"] },
  { id: "scan_radius", label: "تنظیم شعاع اسکن", cat: "info", op: false, desc: "شعاع اسکن محیط را تنظیم می‌کند (پیش‌فرض ۱۰۰۰ بلوک، تا ۱۰۰۰۰۰)", kind: "api", samples: ["اسکن ۱۰۰۰ بلوکی", "شعاع اسکن"] },

  /* ---------- ارتباط و چت (۸) ---------- */
  { id: "say", label: "حرف زدن در چت", cat: "chat", op: false, desc: "پیام در چت بازی", kind: "api", samples: ["تو چت بگو"] },
  { id: "whisper", label: "پیام خصوصی", cat: "chat", op: false, desc: "پیام به بازیکن مشخص", kind: "api", samples: ["به فلانی بگو"] },
  { id: "announce", label: "اعلان مهم", cat: "chat", op: true, desc: "پیام رسمی /say", kind: "op", template: "say {item}", samples: ["اعلان کن"] },
  { id: "greet_player", label: "خوش‌آمدگویی", cat: "chat", op: false, desc: "بازیکن تازه را خوش‌آمد می‌گوید", kind: "api", samples: ["خوش‌آمد بگو"] },
  { id: "chat_bridge_on", label: "روشن کردن گفت‌وگوی بازی", cat: "chat", op: false, desc: "جواب چت بازیکنان را می‌دهد 💬", kind: "api", samples: ["گفتگو رو روشن کن"] },
  { id: "chat_bridge_off", label: "خاموش کردن گفت‌وگوی بازی", cat: "chat", op: false, desc: "چت بازی خاموش", kind: "api", samples: ["گفتگو رو خاموش کن"] },
  { id: "tell_coords", label: "گفتن مختصات در چت", cat: "chat", op: false, desc: "مختصاتش را اعلام می‌کند", kind: "api", samples: ["مختصاتت رو بگو"] },
  { id: "call_me", label: "صدا زدن بازیکن", cat: "chat", op: false, desc: "بازیکن را صدا می‌زند", kind: "api", samples: ["صدام کن"] },

  /* ---------- سرگرمی (۱۰) ---------- */
  { id: "dance", label: "رقصیدن", cat: "fun", op: false, desc: "بالا و پایین می‌پرد 💃", kind: "api", samples: ["برقص"] },
  { id: "spin", label: "چرخیدن", cat: "fun", op: false, desc: "دور خودش می‌چرخد", kind: "api", samples: ["بخچر"] },
  { id: "wave", label: "دست تکان دادن", cat: "fun", op: false, desc: "سلام می‌کند", kind: "api", samples: ["دست تکون بده"] },
  { id: "sneak_spam", label: "اسنیک ریتمیک", cat: "fun", op: false, desc: "نشست و برخاست", kind: "api", samples: ["اسنیک بزن"] },
  { id: "hide", label: "قایم شدن", cat: "fun", op: true, desc: "به بالا تلپورت می‌کند", kind: "op", template: "tp {self} {x} {y} {z}", samples: ["قایم شو"] },
  { id: "drop_item_fun", label: "هدیه دادن آیتم", cat: "fun", op: false, desc: "آیتم جلوی پا می‌اندازد", kind: "api", samples: ["هدیه بده"] },
  { id: "bow_to", label: "احترام", cat: "fun", op: false, desc: "جلوی بازیکن تعظیم", kind: "api", samples: ["احترام بذار"] },
  { id: "party", label: "جشن گرفتن", cat: "fun", op: false, desc: "پرش و چرخش", kind: "api", samples: ["جشن بگیر"] },
  { id: "roleplay_police", label: "نقش پلیس", cat: "fun", op: false, desc: "حالت پلیسی با اعلام 🚔", kind: "api", samples: ["پلیس شو"] },
  { id: "roleplay_bodyguard", label: "نقش محافظ", cat: "fun", op: false, desc: "همیشه کنارت می‌ایستد", kind: "api", samples: ["محافظ شخصی باش"] },

  /* حالت‌های شخصیتی و وود پمپ */
  { id: "personality_angry", label: "حالت vood pump (عصبانی)", cat: "modes", op: true, desc: "فوق‌العاده عصبانی و جنگ‌طلب — سرعت/قدرت زیاد", kind: "api", samples: ["وود پمپ کن", "عصبانی شو", "حالت خشم"] },
  { id: "personality_kind", label: "حالت فوق‌العاده مهربون", cat: "modes", op: false, desc: "با همه مهربون، محافظ همه در برابر ماب", kind: "api", samples: ["مهربون شو", "حالت مهربون"] },
  { id: "personality_normal", label: "حالت عادی", cat: "modes", op: false, desc: "با هم‌تیمی‌ها خوب، نسبت به بقیه خنثی", kind: "api", samples: ["عادی شو", "حالت معمولی"] },
  { id: "speed_tp_on", label: "سرعت موشکی زیاد", cat: "modes", op: true, desc: "تلپورت پی‌درپی جلو مثل موشک (نیازمند OP)", kind: "api", samples: ["سرعتت رو زیاد کن", "سرعت موشکی"] },
  { id: "speed_tp_off", label: "خاموش‌کردن سرعت زیاد", cat: "modes", op: false, desc: "بازگشت به سرعت عادی", kind: "api", samples: ["سرعت خاموش", "آروم شو"] },
  { id: "kill_squad", label: "حمله به بازیکن و اطرافیانش", cat: "combat", op: true, desc: "هدف + اطرافیانش — بجز تو و دوستان", kind: "api", samples: ["فلانی رو بکش", "بکشش"] },
  { id: "pickup_items", label: "برداشتن آیتم‌ها + تشکر", cat: "modes", op: false, desc: "آیتم‌های جلوی پایش را برمی‌دارد و تشکر می‌کند", kind: "api", samples: ["اینا رو بردار", "بردارشون"] },
  { id: "friend_add", label: "افزودن دوست", cat: "modes", op: false, desc: "بازیکن را به لیست دوستان اضافه می‌کند", kind: "api", samples: ["فلانی دوستمه", "دوستم حسابش کن"] },
  { id: "friend_remove", label: "حذف دوست", cat: "modes", op: false, desc: "بازیکن را از لیست دوستان حذف می‌کند", kind: "api", samples: ["فلانی دیگه دوستم نیست"] },
  { id: "server_register", label: "رجیستر سرور (رمز ثابت)", cat: "modes", op: false, desc: "ارسال /register با رمز ثابت", kind: "api", samples: ["رجیستر کن", "ثبت‌نام کن"] },
  { id: "server_login", label: "لاگین سرور (رمز ثابت)", cat: "modes", op: false, desc: "ارسال /login با رمز ثابت", kind: "api", samples: ["لاگین کن", "وارد شو"] },

  /* =====══════════ احضار ماب‌ها (OP) ═══════════===== */
  { id: "summon_zombie", label: "احضار زامبی", cat: "player", op: true, desc: "یک زامبی کنار ربات احضار می‌کند", kind: "op", template: "summon zombie {x} {y} {z}", samples: ["زامبی احضار کن", "یه زامبی بیار"] },
  { id: "summon_skeleton", label: "احضار اسکلت", cat: "player", op: true, desc: "یک اسکلت کماندار احضار می‌کند", kind: "op", template: "summon skeleton {x} {y} {z}", samples: ["اسکلت احضار کن", "یه اسکلت بیار"] },
  { id: "summon_creeper", label: "احضار کریپر", cat: "player", op: true, desc: "یک کریپر احضار می‌کند", kind: "op", template: "summon creeper {x} {y} {z}", samples: ["کریپر احضار کن", "یه کریپر بیار"] },
  { id: "summon_enderman", label: "احضار اندرمن", cat: "player", op: true, desc: "یک اندرمن احضار می‌کند", kind: "op", template: "summon enderman {x} {y} {z}", samples: ["اندرمن احضار کن", "یه اندرمن بیار"] },
  { id: "summon_spider", label: "احضار عنکبوت", cat: "player", op: true, desc: "یک عنکبوت احضار می‌کند", kind: "op", template: "summon spider {x} {y} {z}", samples: ["عنکبوت احضار کن"] },
  { id: "summon_slime", label: "احضار اسلایم", cat: "player", op: true, desc: "یک اسلایم احضار می‌کند", kind: "op", template: "summon slime {x} {y} {z}", samples: ["اسلایم احضار کن"] },
  { id: "summon_phantom", label: "احضار فانتوم", cat: "player", op: true, desc: "یک فانتوم احضار می‌کند", kind: "op", template: "summon phantom {x} {y} {z}", samples: ["فانتوم احضار کن"] },
  { id: "summon_pillager", label: "احضار پیلیجر", cat: "player", op: true, desc: "یک پیلیجر احضار می‌کند", kind: "op", template: "summon pillager {x} {y} {z}", samples: ["پیلیجر احضار کن"] },
  { id: "summon_ravager", label: "احضار راویجر", cat: "player", op: true, desc: "یک راویجر غول‌پیکر احضار می‌کند", kind: "op", template: "summon ravager {x} {y} {z}", samples: ["راویجر احضار کن"] },
  { id: "summon_ghast", label: "احضار گست", cat: "player", op: true, desc: "یک گست پرنده احضار می‌کند", kind: "op", template: "summon ghast {x} {y} {z}", samples: ["گست احضار کن"] },
  { id: "summon_blaze", label: "احضار بلیز", cat: "player", op: true, desc: "یک بلیز آتشین احضار می‌کند", kind: "op", template: "summon blaze {x} {y} {z}", samples: ["بلیز احضار کن"] },
  { id: "summon_drowned", label: "احضار دراوند", cat: "player", op: true, desc: "یک دراوند احضار می‌کند", kind: "op", template: "summon drowned {x} {y} {z}", samples: ["دراوند احضار کن"] },
  { id: "summon_vex", label: "احضار وکس", cat: "player", op: true, desc: "یک وکس پرنده احضار می‌کند", kind: "op", template: "summon vex {x} {y} {z}", samples: ["وکس احضار کن"] },
  { id: "summon_magma_cube", label: "احضار مگما اسلایم", cat: "player", op: true, desc: "یک مگما اسلایم احضار می‌کند", kind: "op", template: "summon magma_cube {x} {y} {z}", samples: ["مگما اسلایم احضار کن"] },
  { id: "summon_parrot", label: "احضار طوطی", cat: "player", op: false, desc: "یک طوطی رنگی احضار می‌کند", kind: "op", template: "summon parrot {x} {y} {z}", samples: ["طوطی احضار کن"] },
  { id: "summon_wolf", label: "احضار گرگ", cat: "player", op: false, desc: "یک گرگ احضار می‌کند", kind: "op", template: "summon wolf {x} {y} {z}", samples: ["گرگ احضار کن", "سگ بیار"] },
  { id: "summon_cat", label: "احضار گربه", cat: "player", op: false, desc: "یک گربه احضار می‌کند", kind: "op", template: "summon cat {x} {y} {z}", samples: ["گربه احضار کن"] },
  { id: "my_wolf", label: "🐺 گرگ وفادار من", cat: "player", op: true, desc: "گرگ رام‌شدهٔ مخصوص بازیکن احضار می‌کند", kind: "op", template: "summon wolf ~ ~ ~ {Tame:1b,Owner:\"{player}\",CustomName:'\"گرگ وفادار\"'}", samples: ["گرگ من", "سگ من"] },
  { id: "my_cat", label: "🐱 گربهٔ ملوس من", cat: "player", op: true, desc: "گربهٔ رام‌شدهٔ مخصوص بازیکن احضار می‌کند", kind: "op", template: "summon cat ~ ~ ~ {Tame:1b,Owner:\"{player}\",CustomName:'\"گربه ملوس\"'}", samples: ["گربه من"] },
  { id: "summon_horse", label: "احضار اسب", cat: "player", op: false, desc: "یک اسب احضار می‌کند", kind: "op", template: "summon horse {x} {y} {z}", samples: ["اسب احضار کن"] },
  { id: "summon_cow", label: "احضار گاو", cat: "player", op: false, desc: "یک گاو احضار می‌کند", kind: "op", template: "summon cow {x} {y} {z}", samples: ["گاو احضار کن"] },
  { id: "summon_sheep", label: "احضار گوسفند", cat: "player", op: false, desc: "یک گوسفند احضار می‌کند", kind: "op", template: "summon sheep {x} {y} {z}", samples: ["گوسفند احضار کن"] },
  { id: "summon_chicken", label: "احضار مرغ", cat: "player", op: false, desc: "یک مرغ احضار می‌کند", kind: "op", template: "summon chicken {x} {y} {z}", samples: ["مرغ احضار کن"] },
  { id: "summon_villager", label: "احضار ویلیجر", cat: "player", op: false, desc: "یک ویلیجر احضار می‌کند", kind: "op", template: "summon villager {x} {y} {z}", samples: ["ویلیجر احضار کن"] },
  { id: "summon_iron_golem", label: "احضار گولم آهنی", cat: "player", op: false, desc: "یک گولم آهنی محافظ احضار می‌کند", kind: "op", template: "summon iron_golem {x} {y} {z}", samples: ["گولم آهنی احضار کن"] },
  { id: "summon_snow_golem", label: "احضار گولم برفی", cat: "player", op: false, desc: "یک گولم برفی احضار می‌کند", kind: "op", template: "summon snow_golem {x} {y} {z}", samples: ["گولم برفی احضار کن"] },
  { id: "summon_bee", label: "احضار زنبور", cat: "player", op: false, desc: "یک زنبور احضار می‌کند", kind: "op", template: "summon bee {x} {y} {z}", samples: ["زنبور احضار کن"] },
  { id: "summon_fox", label: "احضار روباه", cat: "player", op: false, desc: "یک روباه احضار می‌کند", kind: "op", template: "summon fox {x} {y} {z}", samples: ["روباه احضار کن"] },
  { id: "summon_turtle", label: "احضار لاک‌پشت", cat: "player", op: false, desc: "یک لاک‌پشت دریایی احضار می‌کند", kind: "op", template: "summon turtle {x} {y} {z}", samples: ["لاک‌پشت احضار کن"] },
  { id: "summon_axolotl", label: "احضار آکسلوتل", cat: "player", op: false, desc: "یک آکسلوتل احضار می‌کند", kind: "op", template: "summon axolotl {x} {y} {z}", samples: ["آکسلوتل احضار کن"] },
  { id: "summon_frog", label: "احضار قورباغه", cat: "player", op: false, desc: "یک قورباغه احضار می‌کند", kind: "op", template: "summon frog {x} {y} {z}", samples: ["قورباغه احضار کن"] },
  { id: "summon_allay", label: "احضار الی", cat: "player", op: false, desc: "یک الی کمک‌کننده احضار می‌کند", kind: "op", template: "summon allay {x} {y} {z}", samples: ["الی احضار کن"] },
  { id: "summon_wither", label: "احضار ویزر", cat: "player", op: true, desc: "باس ویزر را احضار می‌کند — مواظب باش!", kind: "op", template: "summon wither {x} {y} {z}", samples: ["ویزر احضار کن", "باس ویزر"] },
  { id: "summon_ender_dragon", label: "احضار اژدهای اند", cat: "player", op: true, desc: "باس اژدهای اند را احضار می‌کند — خطرناک!", kind: "op", template: "summon ender_dragon {x} {y} {z}", samples: ["اژدها احضار کن", "اژدهای اند بیار"] },
  { id: "summon_any", label: "احضار ماب دلخواه", cat: "player", op: true, desc: "هر مابی را با نام احضار می‌کند", kind: "op", template: "summon {mob} {x} {y} {z}", samples: ["فلان ماب رو احضار کن"] },
  { id: "kill_mob_type", label: "کشتن همهٔ یک نوع ماب", cat: "combat", op: true, desc: "همهٔ ماب‌های یک نوع مشخص را حذف می‌کند", kind: "op", template: "kill @e[type={mob}]", samples: ["همهٔ زامبی‌ها رو بکش"] },
  { id: "kill_items", label: "پاک‌سازی آیتم‌های زمین", cat: "world", op: true, desc: "همهٔ آیتم‌های افتاده روی زمین را حذف می‌کند", kind: "op", template: "kill @e[type=item]", samples: ["آیتم‌های زمین رو پاک کن", "زمین رو تمیز کن"] },
  { id: "kill_arrows", label: "پاک‌سازی تیرها", cat: "world", op: true, desc: "همهٔ تیرهای پرنده را حذف می‌کند", kind: "op", template: "kill @e[type=arrow]", samples: ["تیرها رو پاک کن"] },

  /* =====══════════ آیتم‌ها (OP) ═══════════===== */
  { id: "give_diamond", label: "دادن ۶۴ الماس", cat: "player", op: true, desc: "به بازیکن یک استک الماس می‌دهد", kind: "op", template: "give {player} diamond 64", samples: ["الماس بده", "به من الماس بده"] },
  { id: "give_iron_ingot", label: "دادن شمش آهن", cat: "player", op: true, desc: "به بازیکن ۶۴ شمش آهن می‌دهد", kind: "op", template: "give {player} iron_ingot 64", samples: ["آهن بده", "شمش آهن بده"] },
  { id: "give_golden_apple", label: "دادن سیب طلایی", cat: "player", op: true, desc: "به بازیکن ۱۶ سیب طلایی می‌دهد", kind: "op", template: "give {player} golden_apple 16", samples: ["سیب طلایی بده"] },
  { id: "give_totem", label: "دادن تاتم جاودانگی", cat: "player", op: true, desc: "به بازیکن تاتم جاودانگی می‌دهد", kind: "op", template: "give {player} totem_of_undying 1", samples: ["تاتم بده", "تاتم جاودانگی"] },
  { id: "give_elytra", label: "دادن الیترا", cat: "player", op: true, desc: "به بازیکن الیترای پرواز می‌دهد", kind: "op", template: "give {player} elytra 1", samples: ["الیترا بده", "الیترا بده بتونم پرواز کنم"] },
  { id: "give_ender_pearl", label: "دادن مروارید اند", cat: "player", op: true, desc: "به بازیکن ۱۶ مروارید اند می‌دهد", kind: "op", template: "give {player} ender_pearl 16", samples: ["مروارید اند بده"] },
  { id: "give_xp_bottle", label: "دادن بطری تجربه", cat: "player", op: true, desc: "به بازیکن ۶۴ بطری تجربه می‌دهد", kind: "op", template: "give {player} experience_bottle 64", samples: ["بطری تجربه بده", "اکس پی بده"] },
  { id: "give_trident", label: "دادن نیزه", cat: "player", op: true, desc: "به بازیکن نیزه می‌دهد", kind: "op", template: "give {player} trident 1", samples: ["نیزه بده"] },
  { id: "give_diamond_sword", label: "دادن شمشیر الماسی", cat: "player", op: true, desc: "به بازیکن شمشیر الماسی می‌دهد", kind: "op", template: "give {player} diamond_sword 1", samples: ["شمشیر الماسی بده", "شمشیر بده"] },
  { id: "give_diamond_pickaxe", label: "دادن کلنگ الماسی", cat: "player", op: true, desc: "به بازیکن کلنگ الماسی می‌دهد", kind: "op", template: "give {player} diamond_pickaxe 1", samples: ["کلنگ الماسی بده", "کلنگ بده"] },
  { id: "give_netherite_sword", label: "دادن شمشیر ندریتی", cat: "player", op: true, desc: "به بازیکن قوی‌ترین شمشیر را می‌دهد", kind: "op", template: "give {player} netherite_sword 1", samples: ["شمشیر ندریتی بده"] },
  { id: "give_diamond_helmet", label: "دادن کلاهخود الماسی", cat: "player", op: true, desc: "به بازیکن کلاهخود الماسی می‌دهد", kind: "op", template: "give {player} diamond_helmet 1", samples: ["کلاهخود الماسی بده"] },
  { id: "give_diamond_chestplate", label: "دادن سینه‌بند الماسی", cat: "player", op: true, desc: "به بازیکن سینه‌بند الماسی می‌دهد", kind: "op", template: "give {player} diamond_chestplate 1", samples: ["سینه‌بند الماسی بده", "زره الماسی"] },
  { id: "give_steak", label: "دادن استیک", cat: "player", op: false, desc: "به بازیکن ۶۴ استیک می‌دهد", kind: "op", template: "give {player} cooked_beef 64", samples: ["استیک بده", "غذا بده"] },
  { id: "give_golden_carrot", label: "دادن هویج طلایی", cat: "player", op: true, desc: "به بازیکن ۶۴ هویج طلایی می‌دهد", kind: "op", template: "give {player} golden_carrot 64", samples: ["هویج طلایی بده"] },
  { id: "give_potion_heal", label: "دادن اکسیر سلامت", cat: "player", op: true, desc: "به بازیکن اکسیر سلامتی فوری می‌دهد", kind: "op", template: "give {player} potion{Potion:\"minecraft:strong_healing\"} 8", samples: ["اکسیر سلامت بده", "اکسیر جان"] },
  { id: "give_torch", label: "دادن مشعل", cat: "build", op: false, desc: "به بازیکن ۶۴ مشعل می‌دهد", kind: "op", template: "give {player} torch 64", samples: ["مشعل بده"] },
  { id: "give_any", label: "دادن آیتم دلخواه", cat: "player", op: true, desc: "هر آیتمی با هر تعداد به بازیکن می‌دهد", kind: "op", template: "give {player} {item} {n}", samples: ["۱۰ تا سنگ بده"] },

  /* =====══════════ افسون‌ها (OP) ═══════════===== */
  { id: "enchant_sharpness", label: "افسون تیزی ۵", cat: "player", op: true, desc: "شیء دست بازیکن را Sharpness 5 می‌کند", kind: "op", template: "enchant {player} sharpness 5", samples: ["تیزی بزن", "افسون تیزی"] },
  { id: "enchant_knockback", label: "افسون پرتاب ۲", cat: "player", op: true, desc: "شیء دست بازیکن را Knockback 2 می‌کند", kind: "op", template: "enchant {player} knockback 2", samples: ["پرتاب بزن", "افسون پرتاب"] },
  { id: "enchant_fire_aspect", label: "افسون آتش", cat: "player", op: true, desc: "شیء دست بازیکن را Fire Aspect 2 می‌کند", kind: "op", template: "enchant {player} fire_aspect 2", samples: ["افسون آتش", "آتشیش کن"] },
  { id: "enchant_looting", label: "افسون غارت ۳", cat: "player", op: true, desc: "شیء دست بازیکن را Looting 3 می‌کند", kind: "op", template: "enchant {player} looting 3", samples: ["افسون غارت", "غارت بزن"] },
  { id: "enchant_unbreaking", label: "افسون نشکن ۳", cat: "player", op: true, desc: "شیء دست بازیکن را Unbreaking 3 می‌کند", kind: "op", template: "enchant {player} unbreaking 3", samples: ["نشکنش کن", "افسون نشکن"] },
  { id: "enchant_mending", label: "افسون تعمیر", cat: "player", op: true, desc: "شیء دست بازیکن را Mending می‌کند", kind: "op", template: "enchant {player} mending", samples: ["تعمیر بزن", "افسون مندینگ"] },
  { id: "enchant_efficiency", label: "افسون کارایی ۵", cat: "player", op: true, desc: "ابزار دست بازیکن را Efficiency 5 می‌کند", kind: "op", template: "enchant {player} efficiency 5", samples: ["کارایی بزن", "افسون سرعت کلنگ"] },
  { id: "enchant_silk_touch", label: "افسون لمس ابریشمی", cat: "player", op: true, desc: "ابزار دست بازیکن را Silk Touch می‌کند", kind: "op", template: "enchant {player} silk_touch", samples: ["لمس ابریشمی بزن", "سیلک تاچ"] },
  { id: "enchant_fortune", label: "افسون اقبال ۳", cat: "player", op: true, desc: "ابزار دست بازیکن را Fortune 3 می‌کند", kind: "op", template: "enchant {player} fortune 3", samples: ["اقبال بزن", "فورچون"] },
  { id: "enchant_protection", label: "افسون محافظت ۴", cat: "player", op: true, desc: "زرهٔ دست بازیکن را Protection 4 می‌کند", kind: "op", template: "enchant {player} protection 4", samples: ["محافظت بزن", "افسون محافظت"] },
  { id: "enchant_thorns", label: "افسون خار ۳", cat: "player", op: true, desc: "زرهٔ دست بازیکن را Thorns 3 می‌کند", kind: "op", template: "enchant {player} thorns 3", samples: ["خار بزن", "افسون خار"] },
  { id: "enchant_feather_falling", label: "افسون سقوط آرام ۴", cat: "player", op: true, desc: "چکمهٔ دست بازیکن را Feather Falling 4 می‌کند", kind: "op", template: "enchant {player} feather_falling 4", samples: ["سقوط آرام بزن", "ضد سقوط"] },
  { id: "enchant_power", label: "افسون قدرت ۵", cat: "player", op: true, desc: "کمان دست بازیکن را Power 5 می‌کند", kind: "op", template: "enchant {player} power 5", samples: ["قدرت بزن", "افسون قدرت کمان"] },
  { id: "enchant_flame", label: "افسون شعله", cat: "player", op: true, desc: "کمان دست بازیکن را Flame می‌کند", kind: "op", template: "enchant {player} flame", samples: ["شعله بزن", "تیر آتشی"] },
  { id: "enchant_infinity", label: "افسون بی‌نهایت", cat: "player", op: true, desc: "کمان دست بازیکن را Infinity می‌کند", kind: "op", template: "enchant {player} infinity", samples: ["بی‌نهایت بزن", "افسون بی‌نهایت"] },
  { id: "effect_absorption", label: "افکت جذب ۴", cat: "player", op: true, desc: "به بازیکن جذب (قلب زرد) می‌دهد", kind: "op", template: "effect give {player} absorption 999 3", samples: ["افکت جذب", "جذب بده"] },
  { id: "effect_resistance", label: "افکت مقاومت ۴", cat: "player", op: true, desc: "به بازیکن مقاومت در برابر ضربه می‌دهد", kind: "op", template: "effect give {player} resistance 999 3", samples: ["افکت مقاومت", "مقاوم بده"] },
  { id: "effect_haste", label: "افکت عجله ۳", cat: "player", op: true, desc: "سرعت کندن و حملهٔ بازیکن را زیاد می‌کند", kind: "op", template: "effect give {player} haste 999 2", samples: ["افکت عجله", "هیست بده"] },
  { id: "effect_invisibility", label: "افکت نامرئی", cat: "player", op: true, desc: "بازیکن را نامرئی می‌کند", kind: "op", template: "effect give {player} invisibility 999 0", samples: ["نامرئیم کن", "افکت نامرئی"] },
  { id: "effect_levitation", label: "افکت شناوری", cat: "player", op: true, desc: "بازیکن را به بالا شناور می‌کند", kind: "op", template: "effect give {player} levitation 20 2", samples: ["شناورم کن", "افکت پرواز"] },
  { id: "effect_slow_falling", label: "افکت سقوط آهسته", cat: "player", op: true, desc: "بازیکن آهسته و امن سقوط می‌کند", kind: "op", template: "effect give {player} slow_falling 999 0", samples: ["سقوط آهسته", "ضد سقوط کن"] },
  { id: "effect_health_boost", label: "افکت افزایش جان", cat: "player", op: true, desc: "حداکثر جان بازیکن را زیاد می‌کند", kind: "op", template: "effect give {player} health_boost 999 3", samples: ["جانم رو زیاد کن", "افکت جان"] },
  { id: "effect_saturation", label: "افکت سیری", cat: "player", op: true, desc: "گرسنگی بازیکن را کامل می‌کند", kind: "op", template: "effect give {player} saturation 999 5", samples: ["سیرم کن", "افکت سیری"] },
  { id: "effect_instant_health", label: "افکت سلامتی فوری", cat: "player", op: true, desc: "فوراً جان بازیکن را پر می‌کند", kind: "op", template: "effect give {player} instant_health 1 5", samples: ["سلامتیم کن", "هیلم کن"] },
  { id: "effect_hero_of_village", label: "افکت قهرمان روستا", cat: "player", op: true, desc: "تخفیف ویژه در ترید ویلیجرها", kind: "op", template: "effect give {player} hero_of_the_village 999 1", samples: ["قهرمان روستا", "افکت قهرمان"] },
  { id: "effect_custom", label: "افکت دلخواه", cat: "player", op: true, desc: "هر افکتی با هر شدتی به بازیکن می‌دهد", kind: "op", template: "effect give {player} {effect} 999 2", samples: ["افکت دلخواه بده"] },

  /* =====══════════ صدا و ذرات (OP) ═══════════===== */
  { id: "playsound_levelup", label: "صدای لول‌آپ", cat: "fun", op: true, desc: "صدای ارتقای سطح پخش می‌کند", kind: "op", template: "playsound entity.player.levelup master {player}", samples: ["صدای لول آپ", "آهنگ موفقیت"] },
  { id: "playsound_thunder", label: "صدای رعد", cat: "fun", op: true, desc: "صدای رعد و برق پخش می‌کند", kind: "op", template: "playsound entity.lightning_bolt.thunder master {player}", samples: ["صدای رعد", "رعد و برق"] },
  { id: "playsound_explode", label: "صدای انفجار", cat: "fun", op: true, desc: "صدای انفجار پخش می‌کند", kind: "op", template: "playsound entity.generic.explode master {player}", samples: ["صدای انفجار", "بمب صدا"] },
  { id: "playsound_portal", label: "صدای پورتال", cat: "fun", op: true, desc: "صدای پورتال ندر پخش می‌کند", kind: "op", template: "playsound block.portal.trigger master {player}", samples: ["صدای پورتال"] },
  { id: "particle_heart", label: "ذرات قلب", cat: "fun", op: true, desc: "دور بازیکن قلب‌های پرنده می‌پاشد", kind: "op", template: "particle heart {x} {y} {z} 3 3 3 0 100", samples: ["قلب بپاش", "ذرات قلب"] },
  { id: "particle_flame", label: "ذرات آتش", cat: "fun", op: true, desc: "دور بازیکن شعله می‌پاشد", kind: "op", template: "particle flame {x} {y} {z} 3 3 3 0 100", samples: ["آتش بپاش", "ذرات آتش"] },

  /* =====══════════ قوانین بازی و جهان (OP) ═══════════===== */
  { id: "gamerule_mob_griefing_off", label: "خاموش کردن تخریب ماب‌ها", cat: "world", op: true, desc: "ماب‌ها دیگر بلوک خراب نمی‌کنند", kind: "op", template: "gamerule mobGriefing false", samples: ["تخریب ماب‌ها رو خاموش کن", "کریپر بلوک خراب نکنه"] },
  { id: "gamerule_mob_spawning_off", label: "خاموش کردن اسپاون ماب", cat: "world", op: true, desc: "دیگر ماب جدید اسپاون نمی‌شود", kind: "op", template: "gamerule doMobSpawning false", samples: ["اسپاون ماب خاموش", "ماب جدید نیاد"] },
  { id: "gamerule_fire_tick_off", label: "خاموش کردن پخش آتش", cat: "world", op: true, desc: "آتش دیگر پخش نمی‌شود", kind: "op", template: "gamerule doFireTick false", samples: ["آتش پخش نشه", "پخش آتش خاموش"] },
  { id: "gamerule_daylight_off", label: "ثابت کردن روز", cat: "world", op: true, desc: "خورشید دیگر حرکت نمی‌کند", kind: "op", template: "gamerule doDaylightCycle false", samples: ["روز رو ثابت کن", "خورشید وایسه"] },
  { id: "gamerule_weather_cycle_off", label: "ثابت کردن هوا", cat: "world", op: true, desc: "هوا دیگر خودکار عوض نمی‌شود", kind: "op", template: "gamerule doWeatherCycle false", samples: ["هوا ثابت بمونه"] },
  { id: "gamerule_natural_regen_on", label: "بازسازی طبیعی جان", cat: "world", op: true, desc: "بازسازی خودکار جان با سیری فعال می‌شود", kind: "op", template: "gamerule naturalRegeneration true", samples: ["بازسازی جان روشن"] },
  { id: "time_add_day", label: "افزودن یک روز", cat: "world", op: true, desc: "زمان بازی یک روز جلو می‌رود", kind: "op", template: "time add 24000", samples: ["یه روز جلو ببر", "زمان رو یه روز زیاد کن"] },
  { id: "time_add_hour", label: "افزودن یک ساعت", cat: "world", op: true, desc: "زمان بازی یک ساعت جلو می‌رود", kind: "op", template: "time add 1000", samples: ["یه ساعت جلو ببر"] },
  { id: "time_set_ticks", label: "تنظیم زمان دلخواه", cat: "world", op: true, desc: "زمان بازی را با عدد تیک تنظیم می‌کند", kind: "op", template: "time set {n}", samples: ["زمان رو روی ۶۰۰۰ بذار"] },
  { id: "difficulty_easy", label: "سختی آسان", cat: "world", op: true, desc: "سختی بازی را آسان می‌کند", kind: "op", template: "difficulty easy", samples: ["سختی آسان", "بازی رو آسان کن"] },
  { id: "save_world", label: "ذخیرهٔ جهان", cat: "world", op: true, desc: "جهان را ذخیره می‌کند", kind: "op", template: "save-all", samples: ["بازی رو ذخیره کن", "سیو کن"] },
  { id: "forceload_here", label: "لود اجباری اینجا", cat: "world", op: true, desc: "چانک این ناحیه را همیشه لود نگه می‌دارد", kind: "op", template: "forceload add {x} {z}", samples: ["اینجا رو لود نگه دار"] },
  { id: "spreadplayers_tp", label: "پخش کردن بازیکنان", cat: "world", op: true, desc: "بازیکن را در نقطه‌ای تصادفی نزدیک می‌پاشد", kind: "op", template: "spreadplayers {x} {z} 10 100 false {player}", samples: ["پخشم کن", "جای تصادفی ببر"] },
  { id: "lightning_strike", label: "برق زدن صاعقه", cat: "world", op: true, desc: "صاعقه دقیقاً کنار ربات می‌زند", kind: "op", template: "summon lightning_bolt {x} {y} {z}", samples: ["صاعقه بزن", "رعد بیار اینجا"] },
  { id: "tnt_at", label: "تی‌ان‌تی انفجاری", cat: "fun", op: true, desc: "یک تی‌ان‌تی فعال کنار ربات می‌گذارد", kind: "op", template: "summon tnt {x} {y} {z}", samples: ["تی‌ان‌تی بذار", "بمب بذار"] },

  /* =====══════════ تلپورت‌ها (OP) ═══════════===== */
  { id: "tp_up_100", label: "تلپورت ۱۰۰ بلوک به بالا", cat: "player", op: true, desc: "بازیکن را ۱۰۰ بلوک بالا می‌برد", kind: "op", template: "tp {player} ~ ~100 ~", samples: ["ببر بالا", "صد بلوک ببر بالا"] },
  { id: "tp_down_50", label: "تلپورت ۵۰ بلوک به پایین", cat: "player", op: true, desc: "بازیکن را ۵۰ بلوک پایین می‌برد", kind: "op", template: "tp {player} ~ ~-50 ~", samples: ["ببر پایین"] },
  { id: "tp_east", label: "تلپورت به شرق", cat: "player", op: true, desc: "بازیکن را ۳۰ بلوک به شرق می‌برد", kind: "op", template: "tp {player} ~30 ~ ~", samples: ["ببر شرق"] },
  { id: "tp_west", label: "تلپورت به غرب", cat: "player", op: true, desc: "بازیکن را ۳۰ بلوک به غرب می‌برد", kind: "op", template: "tp {player} ~-30 ~ ~", samples: ["ببر غرب"] },
  { id: "tp_north", label: "تلپورت به شمال", cat: "player", op: true, desc: "بازیکن را ۳۰ بلوک به شمال می‌برد", kind: "op", template: "tp {player} ~ ~ ~-30", samples: ["ببر شمال"] },
  { id: "tp_south", label: "تلپورت به جنوب", cat: "player", op: true, desc: "بازیکن را ۳۰ بلوک به جنوب می‌برد", kind: "op", template: "tp {player} ~ ~ ~30", samples: ["ببر جنوب"] },
  { id: "tp_to_spawn", label: "تلپورت به اسپاون", cat: "player", op: true, desc: "بازیکن را به نقطهٔ اسپاون می‌برد", kind: "op", template: "tp {player} 0 100 0", samples: ["ببر اسپاون", "بریم اسپاون"] },
  { id: "tp_self_to_player", label: "رفتن پیش بازیکن با تلپورت", cat: "player", op: true, desc: "ربات فوراً کنار بازیکن تلپورت می‌شود", kind: "op", template: "tp {self} {player}", samples: ["تلپورت کن پیشم"] },
  { id: "tp_player_coords", label: "تلپورت بازیکن به مختصات", cat: "player", op: true, desc: "بازیکن را به مختصات دلخواه می‌برد", kind: "op", template: "tp {player} {x} {y} {z}", samples: ["منو ببر به مختصات"] },

  /* =====══════════ تجهیزات و ویژگی‌ها (OP) ═══════════===== */
  { id: "item_replace_helmet", label: "کلاهخود الماسی روی سر", cat: "player", op: true, desc: "فوراً کلاهخود الماسی می‌پوشاند", kind: "op", template: "item replace entity {player} armor.head with diamond_helmet", samples: ["کلاهخود بپوشونم"] },
  { id: "item_replace_chestplate", label: "سینه‌بند الماسی روی بدن", cat: "player", op: true, desc: "فوراً سینه‌بند الماسی می‌پوشاند", kind: "op", template: "item replace entity {player} armor.chest with diamond_chestplate", samples: ["سینه‌بند بپوشونم"] },
  { id: "item_replace_leggings", label: "شلوار الماسی روی پا", cat: "player", op: true, desc: "فوراً شلوار الماسی می‌پوشاند", kind: "op", template: "item replace entity {player} armor.legs with diamond_leggings", samples: ["شلوار زرهی بپوشونم"] },
  { id: "item_replace_boots", label: "چکمهٔ الماسی روی پا", cat: "player", op: true, desc: "فوراً چکمهٔ الماسی می‌پوشاند", kind: "op", template: "item replace entity {player} armor.feet with diamond_boots", samples: ["چکمه بپوشونم"] },
  { id: "attribute_max_health", label: "جان ۴۰ تایی", cat: "player", op: true, desc: "حداکثر جان بازیکن را ۴۰ می‌کند", kind: "op", template: "attribute {player} minecraft:generic.max_health base set 40", samples: ["جانم رو دو برابر کن", "جان ۴۰"] },
  { id: "attribute_speed", label: "سرعت حرکت زیاد", cat: "player", op: true, desc: "سرعت حرکت بازیکن را زیاد می‌کند", kind: "op", template: "attribute {player} minecraft:generic.movement_speed base set 0.3", samples: ["سرعتم رو زیاد کن"] },
  { id: "attribute_attack_damage", label: "قدرت ضربهٔ زیاد", cat: "player", op: true, desc: "قدرت ضربهٔ بازیکن را زیاد می‌کند", kind: "op", template: "attribute {player} minecraft:generic.attack_damage base set 20", samples: ["قدرت ضربه‌م زیاد شه", "ضربه‌م قوی شه"] },
  { id: "attribute_armor", label: "زرهٔ ذاتی ۳۰", cat: "player", op: true, desc: "به بازیکن زرهٔ ذاتی می‌دهد", kind: "op", template: "attribute {player} minecraft:generic.armor base set 30", samples: ["ضدضربه شم", "زره ذاتی"] },

  /* =====══════════ ادمین سرور (OP) ═══════════===== */
  { id: "kick_player", label: "اخراج بازیکن", cat: "chat", op: true, desc: "بازیکن را از سرور اخراج می‌کند", kind: "op", template: "kick {player}", samples: ["فلانی رو کیک کن", "اخراجش کن"] },
  { id: "ban_player", label: "مسدودسازی بازیکن", cat: "chat", op: true, desc: "بازیکن را بن می‌کند", kind: "op", template: "ban {player}", samples: ["فلانی رو بن کن"] },
  { id: "pardon_player", label: "رفع مسدودی", cat: "chat", op: true, desc: "بازیکن بن‌شده را آزاد می‌کند", kind: "op", template: "pardon {player}", samples: ["فلانی رو آزاد کن", "رفع بن"] },
  { id: "op_player", label: "دادن OP", cat: "chat", op: true, desc: "به بازیکن OP می‌دهد", kind: "op", template: "op {player}", samples: ["به فلانی اوپی بده"] },
  { id: "deop_player", label: "گرفتن OP", cat: "chat", op: true, desc: "OP بازیکن را می‌گیرد", kind: "op", template: "deop {player}", samples: ["اوپی فلانی رو بگیر"] },
  { id: "whitelist_add", label: "افزودن به وایت‌لیست", cat: "chat", op: true, desc: "بازیکن را به وایت‌لیست اضافه می‌کند", kind: "op", template: "whitelist add {player}", samples: ["فلانی رو وایت‌لیست کن"] },
  { id: "whitelist_remove", label: "حذف از وایت‌لیست", cat: "chat", op: true, desc: "بازیکن را از وایت‌لیست حذف می‌کند", kind: "op", template: "whitelist remove {player}", samples: ["فلانی رو از وایت‌لیست در بیار"] },
  { id: "whitelist_on", label: "روشن کردن وایت‌لیست", cat: "chat", op: true, desc: "فقط وایت‌لیست می‌تواند وارد شود", kind: "op", template: "whitelist on", samples: ["وایت‌لیست رو روشن کن"] },

  /* =====══════════ عنوان و اعلان (OP) ═══════════===== */
  { id: "title_welcome", label: "عنوان خوش‌آمد", cat: "chat", op: true, desc: "عنوان خوش‌آمد روی صفحهٔ بازیکن", kind: "op", template: "title {player} title {\"text\":\"خوش اومدی!\",\"color\":\"green\"}", samples: ["عنوان خوش‌آمد بده"] },
  { id: "title_warning", label: "عنوان هشدار", cat: "chat", op: true, desc: "عنوان هشدار قرمز روی صفحهٔ بازیکن", kind: "op", template: "title {player} title {\"text\":\"خطر!\",\"color\":\"red\"}", samples: ["هشدار بده", "خطر رو نشون بده"] },
  { id: "title_victory", label: "عنوان پیروزی", cat: "chat", op: true, desc: "عنوان پیروزی طلایی روی صفحهٔ بازیکن", kind: "op", template: "title {player} title {\"text\":\"برنده شدی!\",\"color\":\"gold\"}", samples: ["عنوان پیروزی"] },
  { id: "emote_me", label: "اکت /me", cat: "chat", op: false, desc: "پیام اکت در چت می‌فرستد", kind: "op", template: "me {text}", samples: ["اکت بده"] },

  /* =====══════════ ساخت فوری (OP) ═══════════===== */
  { id: "build_hut_op", label: "کلبهٔ فوری", cat: "build", op: true, desc: "یک کلبهٔ چوبی توخالی دور ربات می‌سازد", kind: "op", template: "fill ~-2 ~-1 ~-2 ~2 ~3 ~2 oak_planks hollow", samples: ["کلبه بساز", "خونه فوری"] },
  { id: "glass_box_op", label: "جعبهٔ شیشه‌ای", cat: "build", op: true, desc: "دور ربات جعبهٔ شیشه‌ای می‌سازد", kind: "op", template: "fill ~-1 ~ ~-1 ~1 ~2 ~1 glass hollow", samples: ["جعبه شیشه‌ای"] },
  { id: "tower_op", label: "برج فوری", cat: "build", op: true, desc: "یک برج ۱۵ بلوکی زیر پای ربات می‌سازد", kind: "op", template: "fill ~ ~-1 ~ ~ ~15 ~ oak_log", samples: ["برج بساز"] },
  { id: "pyramid_op", label: "هرم شنی", cat: "build", op: true, desc: "یک هرم شنی کوچک می‌سازد", kind: "op", template: "fill ~-4 ~-1 ~-4 ~4 ~-1 ~4 sandstone hollow", samples: ["هرم بساز"] },
  { id: "xp_add_small", label: "۵ سطح تجربه", cat: "player", op: true, desc: "۵ سطح تجربه به بازیکن می‌دهد", kind: "op", template: "xp add {player} 5 levels", samples: ["پنج لول تجربه بده"] },
  { id: "xp_add_large", label: "۵۰ سطح تجربه", cat: "player", op: true, desc: "۵۰ سطح تجربه به بازیکن می‌دهد", kind: "op", template: "xp add {player} 50 levels", samples: ["پنجاه لول تجربه بده", "اکس پی زیاد بده"] },
  { id: "xp_set_30", label: "تنظیم سطح ۳۰", cat: "player", op: true, desc: "سطح تجربهٔ بازیکن را ۳۰ می‌کند", kind: "op", template: "xp set {player} 30 levels", samples: ["سطح تجربه رو ۳۰ کن"] },

  /* =====══════════ حرکت پیشرفته (API) ═══════════===== */
  { id: "walk_forward", label: "راه رفتن جلو", cat: "movement", op: false, desc: "چند قدم به جلو می‌رود", kind: "api", samples: ["برو جلو", "جلو برو"] },
  { id: "turn_left", label: "چرخش به چپ", cat: "movement", op: false, desc: "۹۰ درجه به چپ می‌چرخد", kind: "api", samples: ["بچرخ چپ", "به چپ بگرد"] },
  { id: "turn_right", label: "چرخش به راست", cat: "movement", op: false, desc: "۹۰ درجه به راست می‌چرخد", kind: "api", samples: ["بچرخ راست", "به راست بگرد"] },
  { id: "look_sky", label: "نگاه به آسمان", cat: "movement", op: false, desc: "سرش را به آسمان بلند می‌کند", kind: "api", samples: ["آسمون رو نگاه کن"] },
  { id: "look_ground", label: "نگاه به زمین", cat: "movement", op: false, desc: "به زمین زیر پایش نگاه می‌کند", kind: "api", samples: ["زمین رو نگاه کن"] },
  { id: "nod", label: "سر تکان دادن (آره)", cat: "movement", op: false, desc: "سرش را به نشانهٔ تأیید تکان می‌دهد", kind: "api", samples: ["سر تکون بده", "آره بگو"] },
  { id: "shake_head", label: "سر تکان دادن (نه)", cat: "movement", op: false, desc: "سرش را به نشانهٔ نه تکان می‌دهد", kind: "api", samples: ["نه بگو با سرت"] },
  { id: "jump_n", label: "پرش‌های پشت‌سرهم", cat: "movement", op: false, desc: "چند بار پشت‌سرهم می‌پرد", kind: "api", samples: ["سه بار بپر", "پشت سر هم بپر"] },
  { id: "sprint_burst", label: "دویدن ناگهانی", cat: "movement", op: false, desc: "چند ثانیه با سرعت می‌دود", kind: "api", samples: ["یهو بدو", "اسپرینت کن"] },
  { id: "dodge_left", label: "جاخالی به چپ", cat: "combat", op: false, desc: "فوراً به چپ جاخالی می‌دهد", kind: "api", samples: ["جاخالی چپ"] },
  { id: "dodge_right", label: "جاخالی به راست", cat: "combat", op: false, desc: "فوراً به راست جاخالی می‌دهد", kind: "api", samples: ["جاخالی راست"] },
  { id: "happy_jump", label: "پرش شادی", cat: "fun", op: false, desc: "از خوشحالی می‌پرد و می‌چرخد", kind: "api", samples: ["خوشحالی کن", "شادی کن"] },

  /* =====══════════ نبرد پیشرفته (API) ═══════════===== */
  { id: "attack_hostile", label: "حمله به نزدیک‌ترین خصم", cat: "combat", op: false, desc: "به نزدیک‌ترین ماب خصم حمله می‌کند", kind: "api", samples: ["به خصم حمله کن", "ماب رو بزن"] },
  { id: "crit_attack", label: "ضربهٔ کریتیکال", cat: "combat", op: false, desc: "با پرش ضربهٔ سنگین می‌زند", kind: "api", samples: ["ضربه ویژه بزن", "کریتیکال"] },
  { id: "rapid_attack", label: "ضربه‌های پشت‌سرهم", cat: "combat", op: false, desc: "چند ضربهٔ سریع پشت‌سرهم می‌زند", kind: "api", samples: ["پشت سر هم بزن", "ضربه سریع"] },
  { id: "taunt", label: "مسخره کردن دشمن", cat: "combat", op: false, desc: "دشمن را با حرکت و پیام مسخره می‌کند", kind: "api", samples: ["مسخره‌ش کن", "دشمن رو تیکه بنداز"] },
  { id: "throw_pearl", label: "پرت کردن مروارید اند", cat: "combat", op: false, desc: "مروارید اند را پرت می‌کند", kind: "api", samples: ["مروارید بنداز", "اندروپرته"] },
  { id: "throw_snowball", label: "پرت کردن گوله برف", cat: "combat", op: false, desc: "گوله برف پرت می‌کند", kind: "api", samples: ["گوله برف بنداز"] },
  { id: "throw_egg", label: "پرت کردن تخم‌مرغ", cat: "combat", op: false, desc: "تخم‌مرغ پرت می‌کند", kind: "api", samples: ["تخم مرغ بنداز"] },
  { id: "equip_shield", label: "گرفتن سپر", cat: "combat", op: false, desc: "سپر را در دست فرعی می‌گیرد", kind: "api", samples: ["سپر بگیر", "سپر رو بردار"] },
  { id: "clap", label: "دست زدن", cat: "fun", op: false, desc: "با دست تکان دادن دست می‌زند", kind: "api", samples: ["دست بزن", "کف بزن"] },

  /* =====══════════ بقا و تعامل (API) ═══════════===== */
  { id: "eat_now", label: "غذا خوردن", cat: "gather", op: false, desc: "از غذای کوله‌بار می‌خورد", kind: "api", samples: ["بخور", "غذا بخور"] },
  { id: "drink_potion", label: "نوشیدن اکسیر", cat: "gather", op: false, desc: "اکسیر کوله‌بار را می‌نوشد", kind: "api", samples: ["اکسیر بخور", "اکسیر رو بنوش"] },
  { id: "sleep_now", label: "خوابیدن در تخت", cat: "modes", op: false, desc: "در نزدیک‌ترین تخت می‌خوابد", kind: "api", samples: ["بخواب", "بریم بخوابیم"] },
  { id: "wake_up", label: "بیدار شدن", cat: "modes", op: false, desc: "از خواب بیدار می‌شود", kind: "api", samples: ["بیدار شو", "پاشو"] },
  { id: "fish_start", label: "ماهیگیری", cat: "gather", op: false, desc: "قلاب ماهیگیری می‌اندازد", kind: "api", samples: ["ماهیگیری کن", "قلاب بنداز"] },
  { id: "fish_stop", label: "جمع کردن قلاب", cat: "gather", op: false, desc: "قلاب ماهیگیری را جمع می‌کند", kind: "api", samples: ["قلاب رو جمع کن"] },
  { id: "mount_nearest", label: "سوار شدن", cat: "movement", op: false, desc: "بر نزدیک‌ترین اسب/قایق/واگن سوار می‌شود", kind: "api", samples: ["سوار شو", "بشین روش"] },
  { id: "dismount_now", label: "پیاده شدن", cat: "movement", op: false, desc: "از وسیله پیاده می‌شود", kind: "api", samples: ["پیاده شو", "بیا پایین"] },
  { id: "open_door", label: "باز کردن در", cat: "build", op: false, desc: "نزدیک‌ترین در را باز می‌کند", kind: "api", samples: ["در رو باز کن"] },
  { id: "ring_bell", label: "زدن زنگ", cat: "build", op: false, desc: "نزدیک‌ترین زنگ را به صدا درمی‌آورد", kind: "api", samples: ["زنگ رو بزن"] },
  { id: "press_button", label: "فشردن دکمه", cat: "build", op: false, desc: "نزدیک‌ترین دکمه/اهرم را فشار می‌دهد", kind: "api", samples: ["دکمه رو بزن", "اهرم رو بکش"] },
  { id: "light_campfire", label: "روشن کردن آتش", cat: "build", op: false, desc: "نزدیک‌ترین آتش‌دان را روشن می‌کند", kind: "api", samples: ["آتش رو روشن کن"] },
  { id: "extinguish_campfire", label: "خاموش کردن آتش", cat: "build", op: false, desc: "نزدیک‌ترین آتش‌دان را خاموش می‌کند", kind: "api", samples: ["آتش رو خاموش کن"] },
  { id: "shear_sheep", label: "پشم چیدن", cat: "gather", op: false, desc: "از نزدیک‌ترین گوسفند پشم می‌چیند", kind: "api", samples: ["پشم بچین", "گوسفند رو بچین"] },
  { id: "milk_cow", label: "شیر دوشیدن", cat: "gather", op: false, desc: "از نزدیک‌ترین گاو شیر می‌دوشد", kind: "api", samples: ["شیر بدوش"] },
  { id: "breed_animals", label: "تکثیر حیوانات", cat: "gather", op: false, desc: "حیوانات را با غذا تکثیر می‌کند", kind: "api", samples: ["حیوانات رو تکثیر کن", "جفت‌گیری"] },
  { id: "place_torch_feet", label: "گذاشتن مشعل", cat: "build", op: false, desc: "کنار پایش مشعل می‌گذارد", kind: "api", samples: ["مشعل بذار", "اینجا رو روشن کن"] },

  /* =====══════════ کوله‌بار (API) ═══════════===== */
  { id: "toss_stack", label: "اندازدن آیتم دست", cat: "gather", op: false, desc: "آیتم دستش را می‌اندازد", kind: "api", samples: ["اینو بنداز", "دستت رو خالی کن"] },
  { id: "toss_all", label: "اندازدن همهٔ کوله‌بار", cat: "gather", op: false, desc: "همهٔ کوله‌بارش را روی زمین می‌اندازد", kind: "api", samples: ["همه چی رو بریز", "کوله‌بار رو خالی کن"] },
  { id: "hold_item", label: "دست گرفتن آیتم", cat: "gather", op: false, desc: "آیتم مشخص را در دست می‌گیرد", kind: "api", samples: ["شمشیر رو دستت بگیر"] },
  { id: "select_slot", label: "انتخاب خانهٔ داغ", cat: "gather", op: false, desc: "خانهٔ هات‌بار مشخص را انتخاب می‌کند", kind: "api", samples: ["خانه یک", "اسلات ۳"] },
  { id: "armor_best", label: "پوشیدن بهترین زره", cat: "gather", op: false, desc: "بهترین زرهٔ کوله‌بار را می‌پوشد", kind: "api", samples: ["زره بپوش", "تجهیز شو"] },
  { id: "swap_hands", label: "جابه‌جایی دست‌ها", cat: "gather", op: false, desc: "آیتم دست اصلی و فرعی را عوض می‌کند", kind: "api", samples: ["دست‌هات رو عوض کن"] },
  { id: "clean_inventory", label: "تمیز کردن کوله‌بار", cat: "gather", op: false, desc: "آیتم‌های بی‌فایده را دور می‌ریزد", kind: "api", samples: ["کوله‌بار رو تمیز کن", "آشغال‌ها رو بریز"] },
  { id: "refill_totem", label: "گذاشتن تاتم در دست", cat: "gather", op: false, desc: "تاتم جاودانگی را در دست فرعی می‌گذارد", kind: "api", samples: ["تاتم رو دستت بگیر"] },
  { id: "dig_tunnel", label: "حفر تونل", cat: "gather", op: false, desc: "تونل ۱×۲ جلوی پایش می‌کند", kind: "api", samples: ["تونل بزن", "تونل بکن"] },
  { id: "dig_shaft", label: "حفر چاه", cat: "gather", op: false, desc: "چاه عمودی زیر پایش می‌کند", kind: "api", samples: ["چاه بکن", "بکن پایین"] },

  /* =====══════════ اطلاعات تکمیلی (Info) ═══════════===== */
  { id: "facing_direction", label: "جهت نگاه", cat: "info", op: false, desc: "می‌گوید رو به کدام جهت است", kind: "info", samples: ["رو به کجایی", "کدوم طرفی"] },
  { id: "ping_report", label: "گزارش پینگ", cat: "info", op: false, desc: "پینگ اتصال به سرور را می‌گوید", kind: "info", samples: ["پینگت چنده", "لگ داری؟"] },
  { id: "held_item", label: "آیتم دست", cat: "info", op: false, desc: "می‌گوید چه آیتمی در دست دارد", kind: "info", samples: ["دستت چیه", "چی دستته"] },
  { id: "mob_count", label: "شمارش خصم‌ها", cat: "info", op: false, desc: "تعداد ماب‌های خصم اطراف را می‌شمارد", kind: "info", samples: ["چند تا خصم اطرافه", "دشمن اطراف چند تاست"] },
  { id: "nearby_entities", label: "فهرست موجودات اطراف", cat: "info", op: false, desc: "موجودات اطراف را نام می‌برد", kind: "info", samples: ["کیا اطرافن", "چه موجوداتی اینجان"] },
  { id: "speed_report", label: "گزارش سرعت", cat: "info", op: false, desc: "سرعت حرکت فعلی را می‌گوید", kind: "info", samples: ["سرعتت چنده"] },
  { id: "armor_status", label: "وضعیت زره", cat: "info", op: false, desc: "زره‌های پوشیده‌شده را گزارش می‌دهد", kind: "info", samples: ["زره‌ت چیه", "وضعیت زره"] },
  { id: "block_at_feet", label: "بلوک زیر پا", cat: "info", op: false, desc: "نام بلوک زیر پایش را می‌گوید", kind: "info", samples: ["زیر پات چیه"] },
  { id: "world_ticks", label: "زمان درون بازی", cat: "info", op: false, desc: "تیک فعلی و وضعیت روز/شب را می‌گوید", kind: "info", samples: ["الان تو بازی چنده", "روزه یا شب"] },

  /* =====══════════ سرگرمی گفتاری (API) ═══════════===== */
  { id: "sing_chat", label: "آواز خواندن", cat: "fun", op: false, desc: "در چت آواز می‌خواند", kind: "api", samples: ["آواز بخون", "بخون برام"] },
  { id: "tell_joke_chat", label: "جوک گفتن در چت", cat: "fun", op: false, desc: "یک جوک در چت بازی می‌گوید", kind: "api", samples: ["جوک بگو تو چت"] },
  { id: "count_down", label: "شمارش معکوس", cat: "fun", op: false, desc: "در چت ۳-۲-۱ می‌شمارد", kind: "api", samples: ["شمارش معکوس", "سه دو یک"] },
  { id: "roar", label: "غرش", cat: "fun", op: false, desc: "غرش می‌کند و می‌چرخد", kind: "api", samples: ["غرش کن", "شیر شو"] },
  { id: "freeze", label: "یخ زدن", cat: "modes", op: false, desc: "کاملاً بی‌حرکت می‌ایستد", kind: "api", samples: ["یخ بزن", "فریز"] },
  { id: "unfreeze", label: "آب شدن", cat: "modes", op: false, desc: "از حالت یخ درمی‌آید", kind: "api", samples: ["آب شو", "فریز رو بردار"] },

  /* ═════════════════ سطح خدا — قدرت‌های مطلق (API) ═════════════════ */
  { id: "god_mode_on", label: "👑 حالت خدا — روشن", cat: "player", op: true, desc: "مقاومت ۴ + جذب + بازسازی + جان افزون + ضدآتش — شکست‌ناپذیر", kind: "api", samples: ["حالت خدا روشن", "خدایی شو", "god mode on"] },
  { id: "god_mode_off", label: "👑 حالت خدا — خاموش", cat: "player", op: true, desc: "همهٔ افکت‌های خدایی را پاک می‌کند", kind: "api", samples: ["حالت خدا خاموش", "عادی شو خدا"] },
  { id: "god_heal", label: "👑 شفا مطلق", cat: "player", op: true, desc: "سلامتی و سیری کامل فوری", kind: "api", samples: ["شفای مطلق", "سلامتی خدا"] },
  { id: "god_kit", label: "👑 کیت خدا", cat: "player", op: true, desc: "ست کامل ندریت + شمشیر/کلنگ + تاتم + سیب طلایی", kind: "api", samples: ["کیت خدا بده", "تجهیزات خدا"] },
  { id: "one_punch", label: "👑 مشت یک‌ضربه‌ای", cat: "player", op: true, desc: "قدرت ضربه ۱۰۰۰ — هر چیزی با یک ضربه", kind: "api", samples: ["مشت یک ضربه", "one punch"] },
  { id: "god_health", label: "👑 جان ابدی", cat: "player", op: true, desc: "حداکثر جان ۲۰۴۸ — تقریباً نامیرا", kind: "api", samples: ["جان ابدی", "نامیرا شو"] },
  { id: "god_speed", label: "👑 سرعت خدا", cat: "player", op: true, desc: "افکت سرعت سطح ۲۵۵ — مافوق صوت", kind: "api", samples: ["سرعت خدا", "سریع‌تر از باد"] },
  { id: "god_jump", label: "👑 پرش خدا", cat: "player", op: true, desc: "پرش ۲۵۵ + سقوط آهسته — پرواز واقعی", kind: "api", samples: ["پرش خدا", "بپر مثل خدا"] },
  { id: "god_vision", label: "👑 دید خدا (دیواربین)", cat: "player", op: true, desc: "دید شب + درخشش همهٔ ماب‌ها از پشت دیوار", kind: "api", samples: ["دید خدا", "دیواربین شو"] },
  { id: "god_strength", label: "👑 قدرت خدا", cat: "player", op: true, desc: "افکت قدرت سطح ۲۵۵", kind: "api", samples: ["قدرت خدا", "قوی شو خدا"] },
  { id: "god_regen", label: "👑 بازسازی ابدی", cat: "player", op: true, desc: "بازسازی جان سطح ۲۵۵ — همیشه پر", kind: "api", samples: ["بازسازی ابدی"] },
  { id: "god_vanish", label: "👑 نامرئی مطلق", cat: "player", op: true, desc: "نامرئی سطح ۲۵۵ برای مدت طولانی", kind: "api", samples: ["نامرئی مطلق", "غیب شو"] },

  /* ── زیرمجموعهٔ حالت خدا: مهروموم خدایی (Divine Seal) ── */
  { id: "god_seal_on", label: "🪬 مهروموم خدایی (Divine Seal)", cat: "player", op: true, level: "god", desc: "زیرمجموعهٔ سطح خدا — دشمن را مهروموم می‌کند: کندی ۲۵۵ + ناتوانی + خستگی حفاری + ماجراجویی + درخشش؛ هدف و فاصله و دوستان را بررسی می‌کند — فقط در سطح خدا", descEn: "Divine Seal — a God Mode sub-ability: seals the enemy with extreme slowness, weakness, mining fatigue, adventure mode and glowing. Checks target, distance and friends; God level only.", kind: "api", samples: ["مهروموم خدایی", "مهروموم روی فلانی", "قفل خدایی بزن", "divine seal"] },
  { id: "god_seal_off", label: "🔓 باز کردن مهروموم خدایی", cat: "player", op: true, desc: "مهروموم را از یک هدف یا همه باز می‌کند — برای خاموش/توقف عملیات؛ حتی خارج از سطح خدا در دسترس است", descEn: "Lifts the Divine Seal from one target or everyone — the off/stop switch, available even outside God level.", kind: "api", samples: ["مهروموم رو بردار", "مهروموم را باز کن", "همهٔ مهروموم‌ها رو باز کن", "divine seal off"] },
  { id: "god_pvp", label: "⚔️ نبرد خدایی (God PvP)", cat: "player", op: true, level: "god", desc: "ترکیب سطح خدا: شناسایی دشمن (بجز دوستان) ← نبرد واقعی ← مهروموم خدایی ← تأیید نتیجه و ادامه یا عقب‌نشینی — فقط در سطح خدا", descEn: "God PvP — identify the enemy (never friends), fight with real mechanics, apply the Divine Seal when ready, then confirm and continue or retreat.", kind: "api", samples: ["نبرد خدایی", "پی وی پی", "نبرد خدایی روی فلانی", "god pvp"] },

  /* ═════════════════ سطح خدا — مگاسازه‌ها (OP/API) ═════════════════ */
  { id: "castle_op", label: "🏰 قلعهٔ عظیم", cat: "build", op: true, desc: "قلعهٔ سنگی توخالی ۲۱×۲۱ دور ربات", kind: "op", template: "fill ~-10 ~-1 ~-10 ~10 ~12 ~10 stone_bricks hollow", samples: ["قلعه بساز", "قلعه عظیم"] },
  { id: "pyramid_mega", label: "🏛️ هرم عظیم پلکانی", cat: "build", op: true, desc: "هرم شنی چندلایه با یک فرمان", kind: "api", samples: ["هرم عظیم بساز", "هرم بزرگ"] },
  { id: "stadium_op", label: "🏟️ ورزشگاه", cat: "build", op: true, desc: "سازهٔ ورزشگاهی ۴۱×۴۱ توخالی", kind: "op", template: "fill ~-20 ~-1 ~-20 ~20 ~8 ~20 stone_brick hollow", samples: ["ورزشگاه بساز"] },
  { id: "bridge_long_op", label: "🌉 پل طولانی", cat: "build", op: true, desc: "پل چوبی ۶۰ بلوکی از روی هر چیزی", kind: "op", template: "fill ~-30 ~-1 ~-2 ~30 ~-1 ~2 oak_planks", samples: ["پل بساز", "پل طولانی"] },
  { id: "wall_long_op", label: "🧱 دیوار بزرگ", cat: "build", op: true, desc: "دیوار دفاعی ۶۰ بلوکی", kind: "op", template: "fill ~-30 ~-1 ~-1 ~30 ~10 ~1 cobblestone", samples: ["دیوار بزرگ بساز", "دیوار دفاعی"] },
  { id: "road_op", label: "🛣️ جاده", cat: "build", op: true, desc: "جادهٔ شنی ۵۰ بلوکی", kind: "op", template: "fill ~-25 ~-1 ~-2 ~25 ~-1 ~2 gravel", samples: ["جاده بساز"] },
  { id: "lake_op", label: "🌊 دریاچه", cat: "build", op: true, desc: "دریاچهٔ آب ۱۷×۱۷", kind: "op", template: "fill ~-8 ~-2 ~-8 ~8 ~-1 ~8 water", samples: ["دریاچه بساز"] },
  { id: "mountain_op", label: "⛰️ کوه", cat: "build", op: true, desc: "کوه سنگی ۲۵×۲۵ ارتفاع ۱۶", kind: "op", template: "fill ~-12 ~-1 ~-12 ~12 ~15 ~12 stone", samples: ["کوه بساز"] },
  { id: "island_op", label: "🏝️ جزیره", cat: "build", op: true, desc: "جزیرهٔ چمنی ۲۱×۲۱", kind: "op", template: "fill ~-10 ~-1 ~-10 ~10 ~-1 ~10 grass_block", samples: ["جزیره بساز"] },
  { id: "pixel_heart_op", label: "❤️ قلب پیکسلی", cat: "build", op: true, desc: "قلب قرمز پیکسلی بزرگ", kind: "op", template: "fill ~-3 ~ ~-1 ~3 ~4 ~-1 red_concrete", samples: ["قلب بساز", "قلب پیکسلی"] },
  { id: "trench_op", label: "🕳️ خندق", cat: "build", op: true, desc: "خندق عمیق ۳۱ بلوکی", kind: "op", template: "fill ~-15 ~-1 ~-2 ~15 ~-12 ~2 air", samples: ["خندق بکن"] },
  { id: "arena_op", label: "⚔️ آرنای نبرد", cat: "build", op: true, desc: "آرنای نبرد ۳۱×۳۱ با کف سنگی", kind: "api", samples: ["آرنا بساز", "میدان نبرد"] },
  { id: "farm_op", label: "🌾 مزرعه", cat: "build", op: true, desc: "مزرعهٔ شخم‌خورده با آب مرکزی", kind: "api", samples: ["مزرعه بساز"] },
  { id: "gold_floor_op", label: "✨ طبقهٔ طلایی", cat: "build", op: true, desc: "کف طلایی ۱۷×۱۷ — تجمل مطلق", kind: "op", template: "fill ~-8 ~-1 ~-8 ~8 ~-1 ~8 gold_block", samples: ["کف طلایی", "طبقه طلایی"] },
  { id: "snow_field_op", label: "❄️ دشت برفی", cat: "build", op: true, desc: "دشت برفی ۲۱×۲۱", kind: "op", template: "fill ~-10 ~-1 ~-10 ~10 ~-1 ~10 snow_block", samples: ["دشت برفی بساز", "برفیش کن"] },

  /* ═════════════════ سطح خدا — آخرالزمان و جهان (API/OP) ═════════════════ */
  { id: "meteor_strike", label: "☄️ شلیک شهاب‌سنگ", cat: "world", op: true, desc: "سه گوی آتشین + تی‌ان‌تی از آسمان", kind: "api", samples: ["شهاب سنگ ببار", "شلیک شهاب سنگ"] },
  { id: "nuke_area", label: "💣 بمب اتمی", cat: "world", op: true, desc: "هشت تی‌ان‌تی هم‌زمان — نابودی کامل ناحیه", kind: "api", samples: ["بمب اتمی", "ناحیه رو نابود کن"] },
  { id: "zombie_apocalypse", label: "🧟 آخرالزمان زامبی", cat: "world", op: true, desc: "۱۰ زامبی دور ربات احضار می‌کند", kind: "api", samples: ["آخرالزمان زامبی", "ارتش زامبی"] },
  { id: "wither_storm", label: "💀 طوفان ویزر", cat: "world", op: true, desc: "سه ویزر هم‌زمان — فقط برای شجاع‌ها", kind: "api", samples: ["طوفان ویزر", "سه تا ویزر"] },
  { id: "thunderstorm_op", label: "⛈️ طوفان رعد", cat: "world", op: true, desc: "شب + رعد و برق شدید", kind: "api", samples: ["طوفان رعد", "تاریک و طوفانی شه"] },
  { id: "freeze_mobs", label: "🧊 یخ‌زدن همهٔ ماب‌ها", cat: "world", op: true, desc: "همهٔ ماب‌های دنیا را کند می‌کند", kind: "op", template: "effect give @e[type=!player] slowness 999 255", samples: ["ماب‌ها رو یخ بزن", "همه ماب‌ها وایسن"] },
  { id: "daylight_forever", label: "☀️ روز ابدی", cat: "world", op: true, desc: "همیشه روز — خورشید ثابت", kind: "api", samples: ["روز ابدی", "دیگه شب نشه"] },
  { id: "peaceful_forever", label: "🕊️ صلح ابدی", cat: "world", op: true, desc: "سختی صلح‌آمیز + بدون اسپاون ماب + پاک‌سازی", kind: "api", samples: ["صلح ابدی", "دیگه ماب نیاد"] },
  { id: "time_stop", label: "⏳ ایست زمان", cat: "world", op: true, desc: "زمان، هوا و اسپاون می‌ایستند + ماب‌ها یخ می‌زنند", kind: "api", samples: ["ایست زمان", "زمان متوقف شه"] },
  { id: "time_resume", label: "▶️ ادامهٔ زمان", cat: "world", op: true, desc: "همه‌چیز به حالت عادی برمی‌گردد", kind: "api", samples: ["زمان ادامه پیدا کنه", "همه چی عادی شه"] },

  /* ═════════════════ سطح خدا — سفر بین ابعاد (OP) ═════════════════ */
  { id: "tp_nether", label: "🔥 سفر به ندر", cat: "player", op: true, desc: "ربات به بعد ندر تلپورت می‌شود", kind: "op", template: "execute in minecraft:the_nether run tp {self} ~ ~ ~", samples: ["به ندر برو", "بریم ندر"] },
  { id: "tp_end", label: "🌌 سفر به اند", cat: "player", op: true, desc: "ربات به بعد اند تلپورت می‌شود", kind: "op", template: "execute in minecraft:the_end run tp {self} ~ ~ ~", samples: ["به اند برو", "بریم اند"] },
  { id: "tp_overworld", label: "🌍 بازگشت به دنیای معمولی", cat: "player", op: true, desc: "بازگشت به بعد اورورلد", kind: "op", template: "execute in minecraft:overworld run tp {self} ~ ~ ~", samples: ["برگرد دنیای معمولی", "بیا اورورلد"] },

  /* ═════════════════ سطح خدا — نمایشی (API) ═════════════════ */
  { id: "super_hero_landing", label: "🦸 فرود ابرقهرمانی", cat: "fun", op: true, desc: "پرواز به ارتفاع ۴۰ + فرود آرام نمایشی", kind: "api", samples: ["فرود ابرقهرمانی", "پرواز و فرود"] },
  { id: "god_roar", label: "🌩️ غرش خدا", cat: "fun", op: true, desc: "غرش + صاعقه + چرخش — ورود باشکوه", kind: "api", samples: ["غرش خدا", "ورود باشکوه"] },
  { id: "disco_party", label: "🪩 پارتی دیسکوی خدایی", cat: "fun", op: true, desc: "ذرات رنگی + موسیقی + پرش‌های شاد", kind: "api", samples: ["پارتی دیسکو", "جشن خدایی"] },

  /* ═════════════════ ویژه — باس‌ها و حیوانات خانگی ═════════════════ */
  { id: "boss_zombie", label: "🧟‍♂️ باس زامبی", cat: "combat", op: true, desc: "زامبی غول‌پیکر با جان ۲۰۰ و ضربهٔ سنگین", kind: "op", template: "summon zombie ~ ~ ~ {CustomName:'\"رئیس زامبی\"',Health:200f,Attributes:[{Name:generic.max_health,Base:200},{Name:generic.attack_damage,Base:10},{Name:generic.movement_speed,Base:0.35}]}", samples: ["باس زامبی", "رئیس زامبی بیار"] },
  { id: "boss_skeleton", label: "💀 باس اسکلت", cat: "combat", op: true, desc: "اسکلت افسانه‌ای با جان ۱۵۰ و قدرت تیراندازی", kind: "op", template: "summon skeleton ~ ~ ~ {CustomName:'\"رئیس اسکلت\"',Health:150f,Attributes:[{Name:generic.max_health,Base:150},{Name:generic.attack_damage,Base:8}],HandItems:[{id:bow,Count:1},{}],ArmorItems:[{id:diamond_boots,Count:1},{id:diamond_leggings,Count:1},{id:diamond_chestplate,Count:1},{id:diamond_helmet,Count:1}]}", samples: ["باس اسکلت", "رئیس اسکلت بیار"] },
  { id: "boss_creeper", label: "⚡ کریپر شارژی", cat: "combat", op: true, desc: "کریپر شارژشده — انفجار دو برابر!", kind: "op", template: "summon creeper ~ ~ ~ {powered:1b,CustomName:'\"کریپر شارژی\"'}", samples: ["کریپر شارژی", "کریپر برقی"] },
  { id: "named_dragon", label: "🐲 اژدهای من", cat: "combat", op: true, desc: "اژدهای اند با نام سفارشی", kind: "op", template: "summon ender_dragon ~ ~ ~ {CustomName:'\"اژدهای من\"',Health:200f}", samples: ["اژدهای من", "اژدهای سفارشی"] },
  { id: "pet_wolf_army", label: "🐺 ارتش سگ‌های رئیس", cat: "fun", op: true, desc: "سه گرگ رام‌شده مخصوص تو", kind: "api", samples: ["ارتش سگ", "سگ‌های نگهبان"] },
  { id: "pet_cats", label: "🐱 گربه‌های رئیس", cat: "fun", op: true, desc: "سه گربهٔ رام‌شده", kind: "api", samples: ["گربه‌های من", "ارتش گربه"] },
  { id: "rainbow_sheep", label: "🌈 گوسفندهای رنگین‌کمان", cat: "fun", op: true, desc: "پنج گوسفند رنگی دور تو", kind: "api", samples: ["گوسفندهای رنگین کمان", "گوسفند رنگی"] },
  { id: "baby_zoo", label: "🍼 باغ‌وحش نوزادها", cat: "fun", op: true, desc: "چهار حیوان ناز بچه", kind: "api", samples: ["باغ وحش نوزاد", "حیوان بچه"] },
  { id: "ender_crystal_ring", label: "🔮 حلقهٔ کریستال اند", cat: "fun", op: true, desc: "چهار کریستال درخشان دور تو", kind: "api", samples: ["حلقه کریستال", "کریستال اند"] },

  /* ═════════════════ ویژه — نمایش‌های باشکوه ═════════════════ */
  { id: "firework_show", label: "🎆 نمایش آتش‌بازی", cat: "fun", op: true, desc: "شش فشفشهٔ رنگی آسمانی", kind: "api", samples: ["نمایش آتش بازی", "آتیش بازی"] },
  { id: "diamond_rain", label: "💎 بارش الماس", cat: "fun", op: true, desc: "الماس از آسمان می‌بارد!", kind: "api", samples: ["بارش الماس", "الماس ببار"] },
  { id: "xp_rain", label: "⭐ بارش تجربه", cat: "fun", op: true, desc: "گوی‌های تجربه از آسمان", kind: "api", samples: ["بارش تجربه", "اکس پی ببار"] },
  { id: "lightning_ring", label: "🌩️ حلقهٔ صاعقه", cat: "fun", op: true, desc: "هشت صاعقه در یک حلقهٔ باشکوه", kind: "api", samples: ["حلقه صاعقه", "صاعقه حلقه‌ای"] },
  { id: "beacon_beam", label: "🗼 ستون نور", cat: "build", op: true, desc: "منشور نوری (بیکن) با ستون آهنی — تا آسمان نور می‌زند", kind: "api", samples: ["ستون نور", "بیکن بساز"] },
  { id: "waterfall_op", label: "🌊 آبشار", cat: "build", op: true, desc: "ستون آبشار از ارتفاع ۲۰", kind: "op", template: "fill ~3 ~ ~-1 ~3 ~20 ~1 water", samples: ["آبشار بساز"] },
  { id: "glass_dome_op", label: "🔮 گنبد شیشه‌ای", cat: "build", op: true, desc: "گنبد شیشه‌ای بلند دور تو", kind: "op", template: "fill ~-6 ~-1 ~-6 ~6 ~10 ~6 glass hollow", samples: ["گنبد شیشه‌ای"] },

  /* ═════════════════ ویژه — پایگاه‌ها و سازه‌ها ═════════════════ */
  { id: "sky_base_op", label: "🚀 پایگاه آسمانی", cat: "build", op: true, desc: "سکوی کوارتزی ۱۱×۱۱ در ارتفاع ۴۰", kind: "op", template: "fill ~-5 ~40 ~-5 ~5 ~40 ~5 quartz_block", samples: ["پایگاه آسمانی", "سکوی آسمانی"] },
  { id: "glass_tunnel_op", label: "🚇 تونل شیشه‌ای", cat: "build", op: true, desc: "تونل شیشه‌ای ۳۰ بلوکی جلوی پا", kind: "op", template: "fill ~ ~-1 ~1 ~ ~2 ~30 glass hollow", samples: ["تونل شیشه‌ای"] },
  { id: "watchtower_op", label: "🗼 برج دیدبانی", cat: "build", op: true, desc: "برج دیدبانی ۱۵ بلوکی توخالی", kind: "op", template: "fill ~-2 ~-1 ~-2 ~2 ~15 ~2 cobblestone hollow", samples: ["برج دیدبانی"] },
  { id: "fishing_dock_op", label: "⛵ اسکلهٔ ماهیگیری", cat: "build", op: true, desc: "اسکلهٔ چوبی روی آب", kind: "op", template: "fill ~ ~-1 ~1 ~8 ~-1 ~5 oak_slab", samples: ["اسکله بساز"] },
  { id: "target_range", label: "🎯 میدان تیراندازی", cat: "build", op: true, desc: "ردیف هدف‌های تیراندازی", kind: "op", template: "fill ~5 ~ ~-3 ~5 ~ ~3 target", samples: ["میدان تیراندازی"] },
  { id: "sumo_ring_op", label: "🍯 حلقهٔ سومو", cat: "build", op: true, desc: "حلقهٔ عسلی لغزنده برای مسابقه", kind: "op", template: "fill ~-6 ~ ~-6 ~6 ~ ~6 honey_block hollow", samples: ["حلقه سومو"] },
  { id: "parkour_course", label: "🏃 مسیر پارکور", cat: "build", op: true, desc: "سه سکوی شناور پرشی", kind: "api", samples: ["پارکور بساز", "مسیر پارکور"] },
  { id: "maze_op", label: "🌀 هزارتو", cat: "build", op: true, desc: "دیوارهای هزارتویی گیج‌کننده", kind: "api", samples: ["هزارتو بساز"] },

  /* ═════════════════ ویژه — کیت‌های حرفه‌ای ═════════════════ */
  { id: "miner_pack", label: "⛏️ کیت معدنچی", cat: "gather", op: true, desc: "کلنگ ندریتی + مشعل + غذا", kind: "api", samples: ["کیت معدنچی"] },
  { id: "builder_pack", label: "🧱 کیت سازنده", cat: "build", op: true, desc: "بلوک + شیشه + مشعل برای ساخت", kind: "api", samples: ["کیت سازنده"] },
  { id: "warrior_pack", label: "⚔️ کیت جنگجو", cat: "combat", op: true, desc: "شمشیر + کمان + تیر + سپر + سیب طلایی", kind: "api", samples: ["کیت جنگجو"] },
  { id: "farmer_pack", label: "🌾 کیت کشاورز", cat: "gather", op: true, desc: "بیل + بذر + گندم + کود", kind: "api", samples: ["کیت کشاورز"] },
  { id: "explorer_pack", label: "🧭 کیت کاوشگر", cat: "gather", op: true, desc: "غذا + مشعل + قایق + تخت + قطب‌نما", kind: "api", samples: ["کیت کاوشگر"] },

  /* ═════════════════ ویژه — چالش‌ها و کیفیت زندگی ═════════════════ */
  { id: "challenge_wave", label: "🌊 موج دشمن", cat: "combat", op: true, desc: "حلقهٔ زامبی و اسکلت دور تو", kind: "api", samples: ["موج دشمن", "چالش بده"] },
  { id: "boss_rush", label: "👹 رالی باس", cat: "combat", op: true, desc: "سه باس هم‌زمان — سخت‌ترین چالش", kind: "api", samples: ["رالی باس", "همه باس‌ها"] },
  { id: "hard_rain_op", label: "🌧️ باران سخت", cat: "world", op: true, desc: "باران + سختی بالا", kind: "op", template: "weather rain", samples: ["باران سخت"] },
  { id: "night_swim", label: "🌙 شنای شبانه", cat: "modes", op: true, desc: "تنفس آبی + دید شب — غواصی حرفه‌ای", kind: "api", samples: ["شنای شبانه", "غواص شو"] },
  { id: "safe_landing_op", label: "🪂 فرود امن", cat: "movement", op: true, desc: "سقوط آهستهٔ ۶۰ ثانیه‌ای", kind: "op", template: "effect give {player} slow_falling 60 0", samples: ["فرود امن"] },
  { id: "home_anchor_op", label: "🏠 لنگر خانه", cat: "player", op: true, desc: "اسپاون اینجا + قطب‌نما", kind: "api", samples: ["لنگر خانه", "خونه اینجا"] },
  { id: "speed_builder", label: "⚡ سازندهٔ سریع", cat: "build", op: true, desc: "عجلهٔ ۲۵۵ + تخته برای ساخت‌وساز سریع", kind: "api", samples: ["سازنده سریع"] },

  /* ═════════════════ خفن — کمبوهای افسانه‌ای (API) ═════════════════ */
  { id: "ultimate_warrior", label: "🗡️ جنگجوی افسانه‌ای", cat: "combat", op: true, desc: "کیت جنگجو + حالت خدا + مشت یک‌ضربه — ترکیب کامل", kind: "api", samples: ["جنگجوی افسانه‌ای", "ترکیب جنگ"] },
  { id: "ultimate_builder", label: "🏗️ سازندهٔ افسانه‌ای", cat: "build", op: true, desc: "عجلهٔ خدایی + کیت سازنده + سرعت ساخت", kind: "api", samples: ["سازنده افسانه‌ای", "ترکیب ساخت"] },
  { id: "ultimate_survivor", label: "🛡️ بقای افسانه‌ای", cat: "gather", op: true, desc: "کیت خدا + غواصی + دید خدا — بقا تضمینی", kind: "api", samples: ["بقای افسانه‌ای", "ترکیب بقا"] },
  { id: "apocalypse_now", label: "🌑 آخرالزمان (ترکیبی)", cat: "world", op: true, desc: "شب + طوفان + ارتش زامبی و اسکلت", kind: "api", samples: ["آخرالزمان", "آخرالزمان واقعی"] },
  { id: "peace_day", label: "☮️ روز صلح (ترکیبی)", cat: "world", op: true, desc: "روز ابدی + صلح ابدی + آسمان صاف", kind: "api", samples: ["روز صلح", "همه چی صلح آمیز"] },
  { id: "night_raid", label: "🌙 یورش شبانه", cat: "combat", op: true, desc: "نیمه‌شب + باران + موج دشمن", kind: "api", samples: ["یورش شبانه", "شبیخون"] },
  { id: "birthday_party", label: "🎂 پارتی تولد", cat: "fun", op: true, desc: "آتش‌بازی + قلب + موسیقی + عنوان خوش‌آمد", kind: "api", samples: ["پارتی تولد", "تولد مبارک"] },
  { id: "victory_royale", label: "🏆 پیروزی باشکوه", cat: "fun", op: true, desc: "عنوان پیروزی + آتش‌بازی + صاعقه + موسیقی", kind: "api", samples: ["پیروزی باشکوه", "جشن پیروزی"] },

  /* ═════════════════ خفن — نمایش و سازه (OP/API) ═════════════════ */
  { id: "arrow_rain", label: "🏹 بارش تیر", cat: "combat", op: true, desc: "تیر از آسمان می‌بارد!", kind: "api", samples: ["بارش تیر", "تیر ببار"] },
  { id: "music_playlist", label: "🎵 پخش موسیقی", cat: "fun", op: true, desc: "پلی‌لیست صداهای بازی", kind: "api", samples: ["پخش موسیقی", "آهنگ بذار"] },
  { id: "ice_road_op", label: "🧊 جادهٔ یخی", cat: "build", op: true, desc: "جادهٔ یخی ۳۰ بلوکی روی هر چیزی", kind: "op", template: "fill ~ ~-1 ~1 ~ ~-1 ~30 packed_ice", samples: ["جاده یخی"] },
  { id: "house_op", label: "🏠 خانهٔ ویلایی", cat: "build", op: true, desc: "خانهٔ چوبی با سقف و کف", kind: "api", samples: ["خانه ویلایی", "ویلا بساز"] },
  { id: "cathedral_op", label: "⛪ کلیسا", cat: "build", op: true, desc: "سازهٔ عظیم کلیسایی", kind: "op", template: "fill ~-8 ~-1 ~-8 ~8 ~20 ~8 stone_brick hollow", samples: ["کلیسا بساز"] },
  { id: "peak_logo_op", label: "🅿️ لوگوی Peak", cat: "build", op: true, desc: "لوگوی P پیکسلی غول‌پیکر", kind: "api", samples: ["لوگوی پیک", "لوگوی Peak"] },
  { id: "statue_op", label: "🗿 مجسمهٔ رئیس", cat: "build", op: true, desc: "مجسمهٔ زره‌پوش با شمشیر — با نام تو", kind: "op", template: "summon armor_stand ~ ~1 ~ {CustomName:'\"مجسمهٔ رئیس\"',ShowArms:1b,ArmorItems:[{id:diamond_boots,Count:1},{id:diamond_leggings,Count:1},{id:diamond_chestplate,Count:1},{id:diamond_helmet,Count:1}],HandItems:[{id:netherite_sword,Count:1},{}]}", samples: ["مجسمه بساز", "مجسمه من"] },
  { id: "dance_floor_op", label: "🪩 رقص‌گاه", cat: "build", op: true, desc: "کف درخشان + نت‌های موسیقی", kind: "api", samples: ["رقصگاه بساز", "کف رقص"] },
  { id: "jump_boost_party", label: "🦘 پرش همه", cat: "fun", op: true, desc: "همهٔ بازیکنان پرش فوق‌العاده می‌گیرند", kind: "op", template: "effect give @a jump_boost 300 10", samples: ["پرش همه", "همه بپرن"] },
  { id: "glow_all", label: "✨ درخشش همه", cat: "fun", op: true, desc: "همهٔ بازیکنان از پشت دیوار دیده می‌شوند", kind: "op", template: "effect give @a glowing 999", samples: ["درخشش همه", "همه بدرخشن"] },
  { id: "speedrun_kit", label: "🏁 کیت اسپیدران", cat: "gather", op: true, desc: "مروارید + کلنگ + غذا + تخت + سطل آب", kind: "api", samples: ["کیت اسپیدران"] },
  { id: "fishing_mania", label: "🎣 ماهیگیری دیوانه", cat: "gather", op: true, desc: "قلاب + عجله + تنفس آبی", kind: "api", samples: ["ماهیگیری دیوانه"] }
];

/** پیدا کردن توانایی با شناسه */
export function findCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

/** جست‌وجوی متنی در فهرست */
export function searchCapabilities(q: string): Capability[] {
  const t = q.trim().toLowerCase();
  if (!t) return CAPABILITIES;
  return CAPABILITIES.filter(
    (c) =>
      c.label.toLowerCase().includes(t) ||
      c.desc.toLowerCase().includes(t) ||
      c.id.includes(t) ||
      c.samples.some((s) => s.toLowerCase().includes(t))
  );
}

/** خلاصهٔ فشرده برای پرامپت هوش مصنوعی */
export function capabilitiesPromptDigest(): string {
  const byCat = new Map<CapCategory, Capability[]>();
  for (const c of CAPABILITIES) {
    const arr = byCat.get(c.cat) ?? [];
    arr.push(c);
    byCat.set(c.cat, arr);
  }
  const lines: string[] = [];
  for (const { id: cat, label } of CAP_CATEGORIES) {
    const list = byCat.get(cat) ?? [];
    lines.push(
      `${label}: ` +
        list.map((c) => `${c.id}=${c.label}${c.op ? "(OP)" : ""}`).join("، ")
    );
  }
  return lines.join("\n");
}
