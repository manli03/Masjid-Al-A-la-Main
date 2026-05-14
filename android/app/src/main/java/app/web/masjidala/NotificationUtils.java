package app.web.masjidala;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class NotificationUtils {
    private static final String[] PRAYER_API_MONTHS = {
            "Jan", "Feb", "Mac", "Apr", "Mei", "Jun",
            "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis"
    };

    public static String formatPrayerApiDate(Date date) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(date);

        int day = calendar.get(Calendar.DAY_OF_MONTH);
        int month = calendar.get(Calendar.MONTH);
        int year = calendar.get(Calendar.YEAR);

        return String.format(Locale.ENGLISH, "%02d-%s-%04d", day, PRAYER_API_MONTHS[month], year);
    }

    public static long parsePrayerApiDateTimeMillis(String dateStr, String timeStr) {
        if (dateStr == null || timeStr == null || dateStr.isEmpty() || timeStr.isEmpty()) {
            return 0;
        }

        try {
            String[] dateParts = dateStr.split("-");
            String[] timeParts = timeStr.split(":");

            if (dateParts.length != 3 || timeParts.length < 2) {
                return 0;
            }

            int day = Integer.parseInt(dateParts[0]);
            int month = getPrayerApiMonthIndex(dateParts[1]);
            int year = Integer.parseInt(dateParts[2]);
            int hour = Integer.parseInt(timeParts[0]);
            int minute = Integer.parseInt(timeParts[1]);
            int second = timeParts.length >= 3 ? Integer.parseInt(timeParts[2]) : 0;

            if (month < 0) {
                return 0;
            }

            Calendar calendar = Calendar.getInstance();
            calendar.setLenient(false);
            calendar.set(Calendar.YEAR, year);
            calendar.set(Calendar.MONTH, month);
            calendar.set(Calendar.DAY_OF_MONTH, day);
            calendar.set(Calendar.HOUR_OF_DAY, hour);
            calendar.set(Calendar.MINUTE, minute);
            calendar.set(Calendar.SECOND, second);
            calendar.set(Calendar.MILLISECOND, 0);

            return calendar.getTimeInMillis();
        } catch (IllegalArgumentException e) {
            return 0;
        }
    }

    private static int getPrayerApiMonthIndex(String monthName) {
        for (int i = 0; i < PRAYER_API_MONTHS.length; i++) {
            if (PRAYER_API_MONTHS[i].equalsIgnoreCase(monthName)) {
                return i;
            }
        }
        return -1;
    }

    public static String getCurrentPrayerTime(Context context, String prayerName) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String yearlyPrayerTimesJson = prefs.getString("yearlyPrayerTimes", null);

            if (yearlyPrayerTimesJson != null) {
                JSONObject yearlyPrayerTimes = new JSONObject(yearlyPrayerTimesJson);
                // Get today's date in dd-MMM-yyyy format
                String todayDate = formatPrayerApiDate(new Date());

                // Find today's prayer data
                org.json.JSONArray prayers = yearlyPrayerTimes.getJSONArray("prayers");
                for (int i = 0; i < prayers.length(); i++) {
                    JSONObject dayData = prayers.getJSONObject(i);
                    if (todayDate.equals(dayData.optString("date"))) {
                        // Map prayer name to JSON property
                        String property = mapPrayerNameToProperty(prayerName);
                        if (property != null) {
                            String rawTime = dayData.optString(property, "");
                            return formatPrayerTime(rawTime);
                        }
                        break;
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.e("NotificationUtils", "Error getting prayer time", e);
        }
        return ""; // Return empty string if not found
    }

    public static String formatPrayerTime(String rawTime) {
        if (rawTime == null || rawTime.isEmpty()) {
            return "";
        }

        try {
            // Parse the time (assuming format HH:mm or HH:mm:ss)
            String[] timeParts = rawTime.split(":");
            if (timeParts.length >= 2) {
                int hour = Integer.parseInt(timeParts[0]);
                int minute = Integer.parseInt(timeParts[1]);

                // Determine AM/PM
                String amPm = (hour >= 12) ? "pm" : "am";

                // Convert to 12-hour format
                if (hour > 12) {
                    hour -= 12;
                } else if (hour == 0) {
                    hour = 12;
                }

                // Format using Malaysian English locale
                Locale msEnglish = new Locale("en", "MY");
                return String.format(msEnglish, "%d:%02d %s", hour, minute, amPm);
            }
        } catch (Exception e) {
            android.util.Log.e("NotificationUtils", "Error formatting prayer time: " + rawTime, e);
        }

        return rawTime; // Return original if parsing fails
    }

    public static String getLocationName(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String yearlyPrayerTimesJson = prefs.getString("yearlyPrayerTimes", null);

            if (yearlyPrayerTimesJson != null) {
                JSONObject yearlyPrayerTimes = new JSONObject(yearlyPrayerTimesJson);
                String zoneCode = yearlyPrayerTimes.optString("zone", "Unknown");
                return getZoneDisplayName(zoneCode);
            }
        } catch (Exception e) {
            android.util.Log.e("NotificationUtils", "Error getting location", e);
        }
        return "Unknown";
    }

    public static String getZoneDisplayName(String zoneCode) {
        if (zoneCode == null || zoneCode.isEmpty()) {
            return "Unknown";
        }

        // Convert to lowercase for case-insensitive matching
        String lowerZoneCode = zoneCode.toLowerCase();

        return switch (lowerZoneCode) {
            case "jhr01" -> "Pulau Aur dan Pulau Pemanggil";
            case "jhr02" -> "Johor Bahru, Kota Tinggi, Mersing, Kulai";
            case "jhr03" -> "Kluang, Pontian";
            case "jhr04" -> "Batu Pahat, Muar, Segamat, Gemas Johor";
            case "kdh01" -> "Kota Setar, Kubang Pasu, Pokok Sena (Daerah Kecil)";
            case "kdh02" -> "Kuala Muda, Yan, Pendang";
            case "kdh03" -> "Padang Terap, Sik";
            case "kdh04" -> "Baling";
            case "kdh05" -> "Bandar Baharu, Kulim";
            case "kdh06" -> "Langkawi";
            case "kdh07" -> "Gunung Jerai";
            case "ktn01" ->
                    "Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai, Mukim Chiku";
            case "ktn03" -> "Gua Musang (Daerah Galas Dan Bertam), Jeli";
            case "mlk01" -> "SELURUH NEGERI MELAKA";
            case "ngs01" -> "Tampin, Jempol";
            case "ngs02" -> "Jelebu, Kuala Pilah, Port Dickson, Rembau, Seremban";
            case "phg01" -> "Pulau Tioman";
            case "phg02" -> "Kuantan, Pekan, Rompin, Muadzam Shah";
            case "phg03" -> "Jerantut, Temerloh, Maran, Bera, Chenor, Jengka";
            case "phg04" -> "Bentong, Lipis, Raub";
            case "phg05" -> "Genting Sempah, Janda Baik, Bukit Tinggi";
            case "phg06" -> "Cameron Highlands, Genting Higlands, Bukit Fraser";
            case "pls01" -> "Kangar, Padang Besar, Arau";
            case "png01" -> "Seluruh Negeri Pulau Pinang";
            case "prk01" -> "Tapah, Slim River, Tanjung Malim";
            case "prk02" -> "Kuala Kangsar, Sg. Siput (Daerah Kecil), Ipoh, Batu Gajah, Kampar";
            case "prk03" -> "Lenggong, Pengkalan Hulu, Grik";
            case "prk04" -> "Temengor, Belum";
            case "prk05" ->
                    "Kg Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pulau Pangkor";
            case "prk06" -> "Selama, Taiping, Bagan Serai, Parit Buntar";
            case "prk07" -> "Bukit Larut";
            case "sbh01" ->
                    "Bahagian Sandakan (Timur), Bukit Garam, Semawang, Temanggong, Tambisan, Bandar Sandakan";
            case "sbh02" ->
                    "Beluran, Telupid, Pinangah, Terusan, Kuamut, Bahagian Sandakan (Barat)";
            case "sbh03" ->
                    "Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku, Bahagian Tawau (Timur)";
            case "sbh04" -> "Bandar Tawau, Balong, Merotai, Kalabakan, Bahagian Tawau (Barat)";
            case "sbh05" -> "Kudat, Kota Marudu, Pitas, Pulau Banggi, Bahagian Kudat";
            case "sbh06" -> "Gunung Kinabalu";
            case "sbh07" ->
                    "Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan, Bahagian Pantai Barat";
            case "sbh08" -> "Pensiangan, Keningau, Tambunan, Nabawan, Bahagian Pendalaman (Atas)";
            case "sbh09" ->
                    "Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pa Sia, Membakut, Weston, Bahagian Pendalaman (Bawah)";
            case "sgr01" -> "Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Rawang, S.Alam";
            case "sgr02" -> "Kuala Selangor, Sabak Bernam";
            case "sgr03" -> "Klang, Kuala Langat";
            case "swk01" -> "Limbang, Lawas, Sundar, Trusan";
            case "swk02" -> "Miri, Niah, Bekenu, Sibuti, Marudi";
            case "swk03" -> "Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu";
            case "swk04" -> "Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit";
            case "swk05" -> "Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai";
            case "swk06" ->
                    "Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkelili, Betong, Spaoh, Pusa, Saratok";
            case "swk07" -> "Serian, Simunjan, Samarahan, Sebuyau, Meludam";
            case "swk08" -> "Kuching, Bau, Lundu, Sematan";
            case "swk09" -> "Zon Khas (Kampung Patarikan)";
            case "trg01" -> "Kuala Terengganu, Marang, Kuala Nerus";
            case "trg02" -> "Besut, Setiu";
            case "trg03" -> "Hulu Terengganu";
            case "trg04" -> "Dungun, Kemaman";
            case "wly01" -> "Kuala Lumpur, Putrajaya";
            case "wly02" -> "Labuan";
            default -> zoneCode; // Return the code if no mapping found
        };
    }

    public static boolean isZikirPrayer(String prayerName) {
        return "Imsak".equals(prayerName) || "Syuruk".equals(prayerName) || "Dhuha".equals(prayerName);
    }

    public static String mapPrayerNameToProperty(String prayerName) {
        return switch (prayerName) {
            case "Imsak" -> "imsak";
            case "Subuh" -> "fajr";
            case "Syuruk" -> "syuruk";
            case "Dhuha" -> "dhuha";
            case "Zuhur" -> "dhuhr";
            case "Asar" -> "asr";
            case "Maghrib" -> "maghrib";
            case "Isyak" -> "isha";
            default -> null;
        };
    }

    public static String[] formatNotificationMessage(String prayerName, String prayerTime, String location, int advanceMinutes) {
        String title;
        String message;

        // Check if this is an advance notification
        if (advanceMinutes > 0) {
            return formatAdvanceNotificationMessage(prayerName, prayerTime, location, advanceMinutes);
        }

        if (isZikirPrayer(prayerName)) {
            // Special messages for zikir prayers
            message = switch (prayerName) {
                case "Imsak" -> {
                    title = "Telah masuk waktu Imsak";
                    yield prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat bersiap sedia untuk berpuasa 🌙";
                }
                case "Syuruk" -> {
                    title = "Telah masuk waktu Syuruk";
                    yield prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat memulakan aktiviti pagi ☀️";
                }
                case "Dhuha" -> {
                    title = "Telah masuk waktu Dhuha";
                    yield prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat menunaikan solat sunat Dhuha 😊";
                }
                default -> {
                    title = "Telah masuk waktu " + prayerName;
                    yield prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat menunaikan solat fardhu 😊";
                }
            };
        } else {
            // Regular prayers
            title = "Telah masuk waktu solat fardhu " + prayerName.toLowerCase();
            message = prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat menunaikan solat fardhu 😊";
        }

        return new String[]{title, message};
    }

    private static String[] formatAdvanceNotificationMessage(String prayerName, String prayerTime, String location, int advanceMinutes) {
        String title;
        String message;

        if (isZikirPrayer(prayerName)) {
            // Advance notifications for zikir prayers (softer, encouraging tone)
            switch (prayerName) {
                case "Imsak" -> {
                    switch (advanceMinutes) {
                        case 5 -> {
                            title = "5 minit lagi menuju waktu Imsak";
                            message = "Bersiaplah, waktu Imsak akan masuk pada " + prayerTime + " di kawasan " + location + ".\n\nGunakan masa ini untuk minum air terakhir atau menyelesaikan sahur 🌙";
                        }
                        case 10, 15 -> {
                            title = (advanceMinutes == 10 ? "10" : "15") + " minit lagi menuju waktu Imsak";
                            message = "Bersiaplah, waktu Imsak akan masuk pada " + prayerTime + " di kawasan " + location + ".\n\nGunakan masa ini untuk melengkapkan sahur anda 🍽️";
                        }
                        case 30 -> {
                            title = "30 minit lagi menuju waktu Imsak";
                            message = "Bersiaplah, waktu Imsak akan masuk pada " + prayerTime + " di kawasan " + location + ".\n\nPastikan anda bersedia sebelum masuk waktu Imsak ⏰";
                        }
                        default -> {
                            title = advanceMinutes + " minit lagi menuju waktu Imsak";
                            message = "Bersiaplah, waktu Imsak akan masuk pada " + prayerTime + " di kawasan " + location + ".\n\nGunakan masa ini untuk bersiap sedia 🌙";
                        }
                    }
                }
                case "Syuruk" -> {
                    switch (advanceMinutes) {
                        case 5 -> {
                            title = "5 minit lagi menuju waktu Syuruk";
                            message = "Waktu Syuruk akan tiba pada " + prayerTime + " di kawasan " + location + ".\n\nMasa terbaik untuk memulakan hari dengan doa dan zikir ☀️";
                        }
                        case 10, 15, 30 -> {
                            title = (advanceMinutes == 10 ? "10" : advanceMinutes == 15 ? "15" : "30") + " minit lagi menuju waktu Syuruk";
                            message = "Waktu Syuruk akan tiba pada " + prayerTime + " di kawasan " + location + ".\n\nGunakan masa ini untuk menyiapkan diri menyambut awal pagi dengan penuh berkat 🌸";
                        }
                        default -> {
                            title = advanceMinutes + " minit lagi menuju waktu Syuruk";
                            message = "Waktu Syuruk akan tiba pada " + prayerTime + " di kawasan " + location + ".\n\nMasa terbaik untuk memulakan hari dengan doa dan zikir ☀️";
                        }
                    }
                }
                case "Dhuha" -> {
                    switch (advanceMinutes) {
                        case 5 -> {
                            title = "5 minit lagi menuju waktu Dhuha";
                            message = "Waktu Dhuha akan tiba pada " + prayerTime + " di kawasan " + location + ".\n\nBersedialah untuk solat sunat Dhuha yang penuh keberkatan 😊";
                        }
                        case 10, 15, 30 -> {
                            title = (advanceMinutes == 10 ? "10" : advanceMinutes == 15 ? "15" : "30") + " minit lagi menuju waktu Dhuha";
                            message = "Waktu Dhuha akan tiba pada " + prayerTime + " di kawasan " + location + ".\n\nLuangkan masa seketika untuk merancang solat sunat Dhuha yang memberi ketenangan ✨";
                        }
                        default -> {
                            title = advanceMinutes + " minit lagi menuju waktu Dhuha";
                            message = "Waktu Dhuha akan tiba pada " + prayerTime + " di kawasan " + location + ".\n\nBersedialah untuk solat sunat Dhuha yang penuh keberkatan 😊";
                        }
                    }
                }
                default -> {
                    title = advanceMinutes + " minit lagi menuju waktu " + prayerName;
                    message = "Waktu " + prayerName + " akan tiba pada " + prayerTime + " di kawasan " + location + ".\n\nGunakan masa ini untuk bersiap sedia ✨";
                }
            }
        } else {
            // Advance notifications for fardhu prayers (firmer reminders)
            switch (advanceMinutes) {
                case 5 -> {
                    title = "5 minit lagi masuk waktu solat " + prayerName;
                    message = "Waktu solat " + prayerName + " akan masuk pada " + prayerTime + " di kawasan " + location + ".\n\nAmbillah wuduk dan bersiaplah untuk menunaikan kewajipan 🕌";
                }
                case 10 -> {
                    title = "10 minit lagi menuju waktu solat " + prayerName;
                    message = "Waktu solat " + prayerName + " akan tiba pada " + prayerTime + " di kawasan " + location + ".\n\nGunakan masa ini untuk bersedia dan jangan bertangguh ⏳";
                }
                case 15 -> {
                    title = "15 minit lagi sebelum solat " + prayerName;
                    message = "Waktu solat " + prayerName + " akan masuk pada " + prayerTime + " di kawasan " + location + ".\n\nIngatlah solat itu tiang agama, bersiaplah dengan hati yang ikhlas 🤲";
                }
                case 30 -> {
                    title = "30 minit lagi menuju waktu solat " + prayerName;
                    message = "Waktu solat " + prayerName + " dijangka pada " + prayerTime + " di kawasan " + location + ".\n\nRancanglah urusan anda agar tidak terlepas solat ⏰";
                }
                default -> {
                    title = advanceMinutes + " minit lagi menuju waktu solat " + prayerName;
                    message = "Waktu solat " + prayerName + " akan masuk pada " + prayerTime + " di kawasan " + location + ".\n\nBersiaplah untuk menunaikan kewajipan 🕌";
                }
            }
        }

        return new String[]{title, message};
    }
}
