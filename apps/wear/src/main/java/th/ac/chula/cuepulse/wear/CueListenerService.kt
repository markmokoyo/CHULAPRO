package th.ac.chula.cuepulse.wear

import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

class CueListenerService : WearableListenerService() {
    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path != "/cuepulse/haptic_cue") return
        val raw = String(messageEvent.data, Charsets.UTF_8)
        val pattern = try {
            JSONObject(raw).optString("pattern", "SOFT_TICK")
        } catch (_: Exception) {
            "SOFT_TICK"
        }
        vibrateForPattern(this, pattern)
    }

    companion object {
        fun vibrateForPattern(context: Context, pattern: String) {
            val vibrator = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            val effect = when (pattern) {
                "DOUBLE_PULSE" -> VibrationEffect.createWaveform(
                    longArrayOf(0, 100, 80, 100),
                    intArrayOf(0, 180, 0, 180),
                    -1
                )
                "GENTLE_WAVE" -> VibrationEffect.createOneShot(300, 150)
                else -> VibrationEffect.createOneShot(80, 120)
            }
            vibrator.vibrate(effect)
        }
    }
}
