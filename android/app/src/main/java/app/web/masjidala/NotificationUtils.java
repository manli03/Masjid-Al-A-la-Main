package app.web.masjidala;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

public class NotificationUtils {

    public static String getCurrentPrayerTime(Context context, String prayerName) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            String yearlyPrayerTimesJson = prefs.getString("yearlyPrayerTimes", null);

            if (yearlyPrayerTimesJson != null) {
                JSONObject yearlyPrayerTimes = new JSONObject(yearlyPrayerTimesJson);
                // Get today's date in dd-MMM-yyyy format
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd-MMM-yyyy", java.util.Locale.ENGLISH);
                String todayDate = sdf.format(new java.util.Date());

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

                // Format as "6:30 am"
                return String.format("%d:%02d %s", hour, minute, amPm);
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

        switch (lowerZoneCode) {
            case "jhr01": return "Pulau Aur dan Pulau Pemanggil";
            case "jhr02": return "Johor Bahru, Kota Tinggi, Mersing, Kulai";
            case "jhr03": return "Kluang, Pontian";
            case "jhr04": return "Batu Pahat, Muar, Segamat, Gemas Johor";
            case "kdh01": return "Kota Setar, Kubang Pasu, Pokok Sena (Daerah Kecil)";
            case "kdh02": return "Kuala Muda, Yan, Pendang";
            case "kdh03": return "Padang Terap, Sik";
            case "kdh04": return "Baling";
            case "kdh05": return "Bandar Baharu, Kulim";
            case "kdh06": return "Langkawi";
            case "kdh07": return "Gunung Jerai";
            case "ktn01": return "Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai, Mukim Chiku";
            case "ktn03": return "Gua Musang (Daerah Galas Dan Bertam), Jeli";
            case "mlk01": return "SELURUH NEGERI MELAKA";
            case "ngs01": return "Tampin, Jempol";
            case "ngs02": return "Jelebu, Kuala Pilah, Port Dickson, Rembau, Seremban";
            case "phg01": return "Pulau Tioman";
            case "phg02": return "Kuantan, Pekan, Rompin, Muadzam Shah";
            case "phg03": return "Jerantut, Temerloh, Maran, Bera, Chenor, Jengka";
            case "phg04": return "Bentong, Lipis, Raub";
            case "phg05": return "Genting Sempah, Janda Baik, Bukit Tinggi";
            case "phg06": return "Cameron Highlands, Genting Higlands, Bukit Fraser";
            case "pls01": return "Kangar, Padang Besar, Arau";
            case "png01": return "Seluruh Negeri Pulau Pinang";
            case "prk01": return "Tapah, Slim River, Tanjung Malim";
            case "prk02": return "Kuala Kangsar, Sg. Siput (Daerah Kecil), Ipoh, Batu Gajah, Kampar";
            case "prk03": return "Lenggong, Pengkalan Hulu, Grik";
            case "prk04": return "Temengor, Belum";
            case "prk05": return "Kg Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pulau Pangkor";
            case "prk06": return "Selama, Taiping, Bagan Serai, Parit Buntar";
            case "prk07": return "Bukit Larut";
            case "sbh01": return "Bahagian Sandakan (Timur), Bukit Garam, Semawang, Temanggong, Tambisan, Bandar Sandakan";
            case "sbh02": return "Beluran, Telupid, Pinangah, Terusan, Kuamut, Bahagian Sandakan (Barat)";
            case "sbh03": return "Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku, Bahagian Tawau (Timur)";
            case "sbh04": return "Bandar Tawau, Balong, Merotai, Kalabakan, Bahagian Tawau (Barat)";
            case "sbh05": return "Kudat, Kota Marudu, Pitas, Pulau Banggi, Bahagian Kudat";
            case "sbh06": return "Gunung Kinabalu";
            case "sbh07": return "Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan, Bahagian Pantai Barat";
            case "sbh08": return "Pensiangan, Keningau, Tambunan, Nabawan, Bahagian Pendalaman (Atas)";
            case "sbh09": return "Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pa Sia, Membakut, Weston, Bahagian Pendalaman (Bawah)";
            case "sgr01": return "Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Rawang, S.Alam";
            case "sgr02": return "Kuala Selangor, Sabak Bernam";
            case "sgr03": return "Klang, Kuala Langat";
            case "swk01": return "Limbang, Lawas, Sundar, Trusan";
            case "swk02": return "Miri, Niah, Bekenu, Sibuti, Marudi";
            case "swk03": return "Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu";
            case "swk04": return "Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit";
            case "swk05": return "Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai";
            case "swk06": return "Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkelili, Betong, Spaoh, Pusa, Saratok";
            case "swk07": return "Serian, Simunjan, Samarahan, Sebuyau, Meludam";
            case "swk08": return "Kuching, Bau, Lundu, Sematan";
            case "swk09": return "Zon Khas (Kampung Patarikan)";
            case "trg01": return "Kuala Terengganu, Marang, Kuala Nerus";
            case "trg02": return "Besut, Setiu";
            case "trg03": return "Hulu Terengganu";
            case "trg04": return "Dungun, Kemaman";
            case "wly01": return "Kuala Lumpur, Putrajaya";
            case "wly02": return "Labuan";
            default: return zoneCode; // Return the code if no mapping found
        }
    }

    public static boolean isZikirPrayer(String prayerName) {
        return "Imsak".equals(prayerName) || "Syuruk".equals(prayerName) || "Dhuha".equals(prayerName);
    }

    public static String mapPrayerNameToProperty(String prayerName) {
        switch (prayerName) {
            case "Imsak": return "imsak";
            case "Subuh": return "fajr";
            case "Syuruk": return "syuruk";
            case "Dhuha": return "dhuha";
            case "Zuhur": return "dhuhr";
            case "Asar": return "asr";
            case "Maghrib": return "maghrib";
            case "Isyak": return "isha";
            default: return null;
        }
    }

    public static String[] formatNotificationMessage(String prayerName, String prayerTime, String location) {
        String title;
        String message;

        if (isZikirPrayer(prayerName)) {
            // Special messages for zikir prayers
            switch (prayerName) {
                case "Imsak":
                    title = "Telah masuk waktu Imsak";
                    message = prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat bersiap sedia untuk berpuasa 🌙";
                    break;
                case "Syuruk":
                    title = "Telah masuk waktu Syuruk";
                    message = prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat memulakan aktiviti pagi ☀️";
                    break;
                case "Dhuha":
                    title = "Telah masuk waktu Dhuha";
                    message = prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat menunaikan solat sunat Dhuha 😊";
                    break;
                default:
                    title = "Telah masuk waktu " + prayerName;
                    message = prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat menunaikan solat fardhu 😊";
                    break;
            }
        } else {
            // Regular prayers
            title = "Telah masuk waktu solat fardhu " + prayerName.toLowerCase();
            message = prayerTime + " bagi kawasan " + location + " dan yang sama waktu dengannya\n\nSelamat menunaikan solat fardhu 😊";
        }

        return new String[]{title, message};
    }
}
