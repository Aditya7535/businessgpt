import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '../../constants/colors';
import { ConversationalProposal } from '../../types';
import Button from '../ui/Button';
import inventoryService from '../../services/inventory.service';
import { ArrowRight, CheckCircle2, PackageCheck } from 'lucide-react-native';

interface StockProposalCardProps {
  proposal: ConversationalProposal;
  onConfirmed?: () => void;
}

export const StockProposalCard: React.FC<StockProposalCardProps> = ({
  proposal,
  onConfirmed,
}) => {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      await inventoryService.confirmConversationalAdjustment(proposal);
      setConfirmed(true);
      if (onConfirmed) onConfirmed();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <View style={styles.successBox}>
        <CheckCircle2 size={18} color={Colors.limeDark} />
        <Text style={styles.successText}>
          Inventory successfully updated: {proposal.product_name} is now {proposal.projected_stock} {proposal.unit}.
        </Text>
      </View>
    );
  }

  const opLabel = proposal.operation === 'ADD' ? '+ Add Stock' : proposal.operation === 'REMOVE' ? '- Deduct Stock' : 'Set Stock';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <PackageCheck size={16} color={Colors.black} />
        <Text style={styles.headerText}>Proposed Inventory Action</Text>
      </View>

      <Text style={styles.productName}>{proposal.product_name}</Text>

      <View style={styles.changeRow}>
        <View style={styles.stockCol}>
          <Text style={styles.stockLabel}>Current</Text>
          <Text style={styles.stockVal}>{proposal.current_stock} {proposal.unit}</Text>
        </View>

        <ArrowRight size={16} color={Colors.border} />

        <View style={styles.stockCol}>
          <Text style={styles.stockLabel}>{opLabel}</Text>
          <Text style={styles.qtyChange}>
            {proposal.operation === 'ADD' ? '+' : proposal.operation === 'REMOVE' ? '-' : ''}
            {proposal.quantity} {proposal.unit}
          </Text>
        </View>

        <ArrowRight size={16} color={Colors.border} />

        <View style={styles.stockCol}>
          <Text style={styles.stockLabel}>Projected</Text>
          <Text style={[styles.stockVal, { color: Colors.limeDark }]}>
            {proposal.projected_stock} {proposal.unit}
          </Text>
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.actions}>
        <Button
          title="Confirm Stock Change"
          variant="primary"
          size="sm"
          loading={loading}
          onPress={handleConfirm}
          style={{ width: '100%' }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.warmBg,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 8,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  stockCol: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 9,
    color: Colors.textDim,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  stockVal: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 2,
  },
  qtyChange: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.black,
    marginTop: 2,
  },
  actions: {
    marginTop: 4,
  },
  errorText: {
    fontSize: 11,
    color: Colors.redDark,
    fontWeight: '700',
    marginBottom: 6,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.limeBg,
    borderWidth: 1.5,
    borderColor: Colors.limeDark,
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  successText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.limeDark,
    flex: 1,
  },
});

export default StockProposalCard;
