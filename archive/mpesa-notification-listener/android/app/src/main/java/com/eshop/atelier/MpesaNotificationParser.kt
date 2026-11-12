package com.eshop.atelier

internal data class MpesaTransaction(
    val transactionCode: String,
    val amount: Double,
    val direction: String,
    val channel: String,
    val counterparty: String,
    val isOwnTransfer: Boolean,
    val timestamp: Long
)

internal data class FakeMpesaAlert(
    val sender: String,
    val transactionCode: String,
    val amount: Double,
    val timestamp: Long
)

internal object MpesaNotificationParser {
    private val referencePattern = Regex("""(?i)\b([A-Z0-9]{8,12})\b[\s.,:;!'-]*confirmed\b""")
    private val amountPattern = Regex("""(?i)\b(?:KSH|KES)\s*[:]?\s*([\d,]+(?:\.\d{1,2})?)\b""")
    private val counterpartyPattern = Regex(
        """(?i)\b(?:sent to|received from|paid to|withdrawn from|deposited to)\s+([^.;\n]+)"""
    )
    private val counterpartyTailPattern = Regex("""\s+(?:\+?\d[\d -]{7,}|on\s+\d{1,2}[/-]\d{1,2})""", RegexOption.IGNORE_CASE)
    private val phonePattern = Regex("""(?<!\d)\+?(?:254[\s()-]*)?0?7(?:[\s()-]*\d){8}(?!\d)""")
    private val transactionClaimPattern = Regex(
        """(?i)\b(?:sent to|received from|paid to|withdrawn from|deposited to|you have received|you received|you sent|you have sent|you paid)\b"""
    )

    fun detectFakeMpesaSender(title: String, body: String, timestamp: Long): FakeMpesaAlert? {
        val sender = title.trim()
        val normalizedSender = sender.replace(Regex("""[^A-Za-z0-9]"""), "")
        if (normalizedSender.equals("MPESA", ignoreCase = true)) return null

        val reference = referencePattern.find(body)?.groupValues?.getOrNull(1)?.uppercase() ?: return null
        val amountText = amountPattern.find(body)?.groupValues?.getOrNull(1) ?: return null
        val amount = amountText.replace(",", "").toDoubleOrNull()?.takeIf { it > 0 } ?: return null
        if (!transactionClaimPattern.containsMatchIn(body)) return null

        return FakeMpesaAlert(
            sender = sender.take(100).ifBlank { "Unknown sender" },
            transactionCode = reference,
            amount = amount,
            timestamp = timestamp
        )
    }

    fun parse(
        title: String,
        body: String,
        timestamp: Long,
        ownNumbers: Set<String> = emptySet(),
        ownNames: Set<String> = emptySet()
    ): MpesaTransaction? {
        val sender = title.replace(Regex("""[^A-Za-z0-9]"""), "")
        val senderInBody = Regex("""(?i)^\s*(?:from\s+)?m[\s.-]*pesa(?:\s*[:\-—]\s*|\s+)""")
        val message = if (senderInBody.containsMatchIn(body)) {
            body.replaceFirst(senderInBody, "")
        } else {
            body
        }
        if (!sender.equals("MPESA", ignoreCase = true) && message == body) return null

        val reference = referencePattern.find(message)?.groupValues?.getOrNull(1)?.uppercase() ?: return null
        val amountText = amountPattern.find(message)?.groupValues?.getOrNull(1) ?: return null
        val amount = amountText.replace(",", "").toDoubleOrNull()?.takeIf { it > 0 } ?: return null
        val normalized = message.lowercase().replace(Regex("""[^a-z0-9]+"""), " ").trim()
        val direction = when {
            Regex("""\b(received from|you have received|you received)\b""").containsMatchIn(normalized) -> "received"
            Regex("""\b(sent to|you sent|you have sent)\b""").containsMatchIn(normalized) -> "sent"
            Regex("""\b(paid to|you paid)\b""").containsMatchIn(normalized) -> "paid"
            "withdrawn" in normalized -> "withdrawn"
            else -> "other"
        }
        val channel = when {
            Regex("""\bpochi\b""").containsMatchIn(normalized) -> "pochi"
            Regex("""\b(paybill|pay bill)\b""").containsMatchIn(normalized) -> "paybill"
            Regex("""\b(till|buy goods)\b""").containsMatchIn(normalized) -> "till"
            Regex("""\bbank\b""").containsMatchIn(normalized) -> "bank"
            direction in setOf("sent", "received") || "send money" in normalized -> "send_money"
            else -> "other"
        }
        val rawCounterparty = counterpartyPattern.find(message)?.groupValues?.getOrNull(1)?.trim().orEmpty()
        val counterpartyEnd = counterpartyTailPattern.find(rawCounterparty)?.range?.first ?: rawCounterparty.length
        val counterparty = rawCounterparty.substring(0, counterpartyEnd).trim().take(100)
        val normalizedCounterparty = normalizeName(counterparty)
        val normalizedOwnNames = ownNames.map(::normalizeName).filter(String::isNotEmpty).toSet()
        val normalizedOwnNumbers = ownNumbers.map(::normalizePhone).filter(String::isNotEmpty).toSet()
        val hasOwnNumber = phonePattern.findAll(rawCounterparty).any { match ->
            normalizePhone(match.value) in normalizedOwnNumbers
        }
        val hasOwnName = normalizedCounterparty in normalizedOwnNames

        return MpesaTransaction(reference, amount, direction, channel, counterparty, hasOwnNumber || hasOwnName, timestamp)
    }

    private fun normalizeName(value: String): String =
        value.lowercase().replace(Regex("""[^a-z0-9]+"""), " ").trim()

    private fun normalizePhone(value: String): String {
        val digits = value.filter(Char::isDigit)
        return when {
            digits.startsWith("254") && digits.length == 12 -> "0${digits.substring(3)}"
            digits.length == 9 && digits.startsWith("7") -> "0$digits"
            digits.length == 10 && digits.startsWith("07") -> digits
            else -> ""
        }
    }
}
