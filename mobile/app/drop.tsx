import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDropItems, markDropCompleted } from '../src/drops';
import { getItemById } from '../src/packs';
import { hasAttempt, getLatestAttempt, type AttemptRecord } from '../src/attempts';

type Phase = 'loading' | 'countdown' | 'sequencing' | 'summary';

interface QuestionResult {
  itemId: string;
  prompt: string;
  correct: boolean;
  score: number;
  attempted: boolean;
}

export default function Drop() {
  const { dropId, itemIds: itemIdsParam } = useLocalSearchParams<{
    dropId?: string;
    itemIds?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('loading');
  const [allItemIds, setAllItemIds] = useState<string[]>([]);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const currentIndex = useRef(0);
  const hasNavigated = useRef(false);

  // Countdown
  const [countNum, setCountNum] = useState(3);
  const countScale = useRef(new Animated.Value(0.3)).current;
  const countdownStartedRef = useRef(false);

  // ── Resolve item IDs on mount ──
  useEffect(() => {
    let ids: string[];

    if (dropId) {
      ids = getDropItems(dropId);
    } else if (itemIdsParam) {
      ids = itemIdsParam.split(',').filter(Boolean);
    } else {
      router.back();
      return;
    }

    if (ids.length === 0) {
      router.back();
      return;
    }

    setAllItemIds(ids);

    // Skip items that are already attempted
    const firstUnattempted = ids.findIndex((id) => !hasAttempt(id));
    if (firstUnattempted === -1) {
      // All pre-attempted — collect results and go to summary
      const allResults = ids.map((id) => collectResult(id));
      setResults(allResults);
      setPhase('summary');
      return;
    }

    // Collect results for pre-attempted items we're skipping
    const preResults: QuestionResult[] = [];
    for (let i = 0; i < firstUnattempted; i++) {
      preResults.push(collectResult(ids[i]));
    }
    setResults(preResults);

    currentIndex.current = firstUnattempted;
    countdownStartedRef.current = false;
    setPhase('countdown');
  }, [dropId, itemIdsParam]);

  // ── 3-2-1 Countdown (once per drop) ──
  useEffect(() => {
    if (phase !== 'countdown') return;

    if (!countdownStartedRef.current) {
      countdownStartedRef.current = true;
      setCountNum(3);
      animateCountPop();
    }

    let num = 3;
    const interval = setInterval(() => {
      num--;
      if (num <= 0) {
        clearInterval(interval);
        setPhase('sequencing');
      } else {
        setCountNum(num);
        animateCountPop();
      }
    }, 800);

    return () => clearInterval(interval);
  }, [phase]);

  const animateCountPop = () => {
    countScale.setValue(0.3);
    Animated.spring(countScale, {
      toValue: 1,
      friction: 4,
      tension: 150,
      useNativeDriver: true,
    }).start();
  };

  // ── Navigate to next question when entering sequencing phase ──
  useEffect(() => {
    if (phase !== 'sequencing' || allItemIds.length === 0) return;
    navigateToQuestion();
  }, [phase, allItemIds]);

  // ── Detect return from question screen ──
  // Uses navigation.addListener('focus') instead of useFocusEffect.
  // useFocusEffect re-fires when its callback deps change AND the screen is
  // focused — on iOS this caused it to run in the same render cycle that
  // pushed question 1, immediately advancing to question 2.
  // addListener('focus') only fires on real focus events (screen regains focus
  // after the user navigates back), avoiding the race.
  useEffect(() => {
    if (phase !== 'sequencing') return;

    return navigation.addListener('focus', () => {
      if (!hasNavigated.current) return;

      const currentId = allItemIds[currentIndex.current];
      if (!currentId) return;

      const result = collectResult(currentId);
      setResults((prev) => [...prev, result]);

      let nextIdx = currentIndex.current + 1;
      while (nextIdx < allItemIds.length && hasAttempt(allItemIds[nextIdx])) {
        setResults((prev) => [...prev, collectResult(allItemIds[nextIdx])]);
        nextIdx++;
      }

      if (nextIdx >= allItemIds.length) {
        if (dropId) markDropCompleted(dropId);
        setPhase('summary');
      } else {
        currentIndex.current = nextIdx;
        hasNavigated.current = false;
        setTimeout(navigateToQuestion, 100);
      }
    });
  }, [phase, allItemIds, navigation]);

  function navigateToQuestion() {
    const id = allItemIds[currentIndex.current];
    if (!id) return;
    hasNavigated.current = true;
    router.push(`/question/${id}?fromDrop=1`);
  }

  function collectResult(itemId: string): QuestionResult {
    const item = getItemById(itemId);
    const attempt = getLatestAttempt(itemId);
    return {
      itemId,
      prompt: item?.prompt ?? 'Unknown question',
      correct: attempt?.correct === 1,
      score: attempt?.scoreDelta ?? 0,
      attempted: !!attempt,
    };
  }

  // ── Render ──

  if (phase === 'countdown') {
    return (
      <View style={styles.center}>
        <Animated.Text style={[styles.countdownText, { transform: [{ scale: countScale }] }]}>
          {countNum}
        </Animated.Text>
      </View>
    );
  }

  if (phase === 'loading' || phase === 'sequencing') {
    const progress = `${Math.min(currentIndex.current + 1, allItemIds.length)}/${allItemIds.length}`;
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Question {progress}</Text>
      </View>
    );
  }

  // ── Summary ──
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const correctCount = results.filter((r) => r.correct).length;
  const allCorrect = results.length > 0 && correctCount === results.length;
  const perfectBonus = allCorrect ? 75 : 0;
  const finalScore = totalScore + perfectBonus;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.summaryContent}>
        <Text style={styles.summaryTitle}>Drop Complete!</Text>

        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Total Score</Text>
          <Text style={[styles.scoreValue, { color: finalScore >= 0 ? '#22c55e' : '#ef4444' }]}>
            {finalScore >= 0 ? '+' : ''}{finalScore}
          </Text>
          {allCorrect && (
            <Text style={styles.perfectBonus}>Perfect Drop! +75 bonus</Text>
          )}
        </View>

        <Text style={styles.correctCount}>
          {correctCount}/{results.length} correct
        </Text>

        {/* Per-question breakdown */}
        <View style={styles.breakdown}>
          {results.map((result, i) => (
            <View key={result.itemId} style={styles.breakdownRow}>
              <Text style={styles.breakdownIdx}>{i + 1}</Text>
              <Text
                style={[
                  styles.breakdownIcon,
                  { color: result.correct ? '#22c55e' : '#ef4444' },
                ]}
              >
                {result.correct ? '\u2713' : '\u2717'}
              </Text>
              <Text style={styles.breakdownPrompt} numberOfLines={2}>
                {result.prompt}
              </Text>
              <Text
                style={[
                  styles.breakdownScore,
                  { color: result.score >= 0 ? '#22c55e' : '#ef4444' },
                ]}
              >
                {result.score >= 0 ? '+' : ''}{result.score}
              </Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: { color: '#8888aa', fontSize: 16 },
  countdownText: {
    fontSize: 96,
    fontWeight: '800',
    color: '#4a6cf7',
  },

  summaryContent: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  summaryTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginTop: 40,
    marginBottom: 24,
  },

  scoreCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  scoreLabel: { color: '#888', fontSize: 14, marginBottom: 4 },
  scoreValue: { fontSize: 48, fontWeight: '800' },
  perfectBonus: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },

  correctCount: { color: '#aaa', fontSize: 16, marginBottom: 24 },

  breakdown: { width: '100%', gap: 8 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  breakdownIdx: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  breakdownIcon: { fontSize: 18, fontWeight: '700', width: 22 },
  breakdownPrompt: { color: '#ccc', fontSize: 14, flex: 1 },
  breakdownScore: { fontSize: 14, fontWeight: '700', minWidth: 50, textAlign: 'right' },

  doneBtn: {
    backgroundColor: '#4a6cf7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginTop: 32,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
