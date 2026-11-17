package th.ac.chula.cuepulse.domain

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

enum class HapticPatternType {
    SOFT_TICK,
    DOUBLE_PULSE,
    GENTLE_WAVE
}

object ScoringEngine {
    const val OPTIMAL_SPM_MIN = 180
    const val OPTIMAL_SPM_MAX = 220
    const val COOLDOWN_MS = 20_000L

    fun calculatePacingScore(averageSpm: Int): Int {
        if (averageSpm <= 0) return 0
        if (averageSpm in OPTIMAL_SPM_MIN..OPTIMAL_SPM_MAX) return 100
        val diff = if (averageSpm < OPTIMAL_SPM_MIN) {
            OPTIMAL_SPM_MIN - averageSpm
        } else {
            averageSpm - OPTIMAL_SPM_MAX
        }
        return max(0, min(100, 100 - (diff * 1.25).roundToInt()))
    }

    fun calculateFluencyScore(fillerPerMinute: Double): Int {
        val penalty = (fillerPerMinute * 12.0).roundToInt()
        return max(0, min(100, 100 - penalty))
    }

    fun calculateOverallScore(
        averageSpm: Int,
        fillerPerMinute: Double,
        eyeContactRatio: Int,
        goodPostureRatio: Int
    ): Int {
        val pacing = calculatePacingScore(averageSpm)
        val fluency = calculateFluencyScore(fillerPerMinute)
        val score = fluency * 0.30 + pacing * 0.25 + eyeContactRatio * 0.25 + goodPostureRatio * 0.20
        return max(0, min(100, score.roundToInt()))
    }
}
