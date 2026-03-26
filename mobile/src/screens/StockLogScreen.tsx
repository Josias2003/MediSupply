import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { apiClient } from "../services/api";

export default function StockLogScreen() {
  const [supplyId, setSupplyId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogStock = async () => {
    if (!supplyId.trim() || !quantity.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const result = await apiClient.logStock(
        parseInt(supplyId),
        parseFloat(quantity),
        notes
      );

      Alert.alert(
        "Success",
        result.queued
          ? "Stock logged (will sync when online)"
          : "Stock logged successfully"
      );

      // Clear form
      setSupplyId("");
      setQuantity("");
      setNotes("");
    } catch (error) {
      Alert.alert("Error", "Failed to log stock. Please try again.");
      console.error("Failed to log stock:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Log Stock Usage</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Supply ID *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter supply ID"
            value={supplyId}
            onChangeText={setSupplyId}
            keyboardType="numeric"
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Quantity Used *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter quantity"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add any notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogStock}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Log Stock</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📝 Offline Support</Text>
          <Text style={styles.infoText}>
            Your stock logs will be saved locally and automatically synced when
            you're back online.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  form: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#0066cc",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "#e3f2fd",
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#0066cc",
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0066cc",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: "#0066cc",
    lineHeight: 18,
  },
});
