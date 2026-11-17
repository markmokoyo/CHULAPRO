package th.ac.chula.cuepulse.wear

import android.content.Context
import android.webkit.JavascriptInterface
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class WearBridgeClient(private val context: Context) {
    private val scope = CoroutineScope(Dispatchers.IO)

    companion object {
        const val HAPTIC_CUE_PATH = "/cuepulse/haptic_cue"
    }

    @JavascriptInterface
    fun sendWearCue(cueJson: String) {
        scope.launch {
            try {
                val nodeClient = Wearable.getNodeClient(context)
                nodeClient.connectedNodes.addOnSuccessListener { nodes ->
                    val msgClient = Wearable.getMessageClient(context)
                    val payload = cueJson.toByteArray(Charsets.UTF_8)
                    for (node in nodes) {
                        msgClient.sendMessage(node.id, HAPTIC_CUE_PATH, payload)
                    }
                }
            } catch (_: Exception) {
                // Ignore if Play Services / Wear OS companion is not paired
            }
        }
    }
}
