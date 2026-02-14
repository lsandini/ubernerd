import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getItemById, decodeField } from '../../src/packs';
import { saveAttempt, hasAttempt } from '../../src/attempts';
import { scoreBase, speedMultiplier } from '../../src/scoring';
import type { Item, ItemType } from '../../src/types';

type Phase = 'loading' | 'countdown' | 'answering' | 'verdict';

const PENALTIES: Record<ItemType, number> = { A: -40, B: -40, AB: -60, K: -100 };

export default function Question() {
  const { id, fromDrop } = useLocalSearchParams<{ id: string; fromDrop?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('loading');
  const [item, setItem] = useState<Item | null>(null);
  const [countNum, setCountNum] = useState(3);
  const [remaining, setRemaining] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctIdx, setCorrectIdx] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [rtMs, setRtMs] = useState(0);
  const [rationale, setRationale] = useState('');
  const [alreadyDone, setAlreadyDone] = useState(false);

  const servedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredRef = useRef(false);
  const countdownStartedRef = useRef(false);

  // Animations
  const countScale = useRef(new Animated.Value(0.3)).current;
  const verdictScale = useRef(new Animated.Value(0.3)).current;
  const timerWidth = useRef(new Animated.Value(1)).current;

  // ── Loading ──
  useEffect(() => {
    if (!id) { router.back(); return; }
    const found = getItemById(id);
    if (!found) { router.back(); return; }
    setItem(found);

    // Decode correct answer for later use
    if (found.correctEnc) {
      setCorrectIdx(parseInt(decodeField(found.correctEnc), 10));
    }
    if (found.rationaleEnc) {
      setRationale(decodeField(found.rationaleEnc));
    }

    // Already attempted? Show verdict directly
    if (hasAttempt(found.id)) {
      setAlreadyDone(true);
      setPhase('verdict');
      return;
    }

    countdownStartedRef.current = false;
    setPhase('countdown');
  }, [id]);

  // ── Countdown (guarded against Strict Mode double-fire) ──
  useEffect(() => {
    if (phase !== 'countdown') return;

    if (!countdownStartedRef.current) {
      countdownStartedRef.current = true;

      // When navigated from a drop, the drop already showed the countdown
      if (fromDrop) {
        startAnswering();
        return;
      }

      setCountNum(3);
      animateCountPop();
    }

    if (fromDrop) return;

    let num = 3;
    const interval = setInterval(() => {
      num--;
      if (num <= 0) {
        clearInterval(interval);
        startAnswering();
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

  // ── Answering ──
  const startAnswering = useCallback(() => {
    if (!item) return;
    servedAtRef.current = Math.floor(Date.now() / 1000);
    answeredRef.current = false;
    setRemaining(item.timeSec);
    setPhase('answering');

    // Animate timer bar
    timerWidth.setValue(1);
    Animated.timing(timerWidth, {
      toValue: 0,
      duration: item.timeSec * 1000,
      useNativeDriver: false,
    }).start();

    // Countdown seconds
    let left = item.timeSec;
    timerRef.current = setInterval(() => {
      left--;
      setRemaining(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        // Timeout — auto-submit as wrong
        if (!answeredRef.current) {
          answeredRef.current = true;
          handleTimeout();
        }
      }
    }, 1000);
  }, [item]);

  const handleTimeout = () => {
    if (!item) return;
    const now = Math.floor(Date.now() / 1000);
    const penalty = PENALTIES[item.type];
    setSelected(-1); // no choice
    setScore(penalty);
    setRtMs(item.timeSec * 1000);

    saveAttempt({
      itemId: item.id,
      domain: item.domain,
      servedAt: servedAtRef.current,
      answeredAt: now,
      rtMs: item.timeSec * 1000,
      choice: -1,
      correct: false,
      scoreDelta: penalty,
    });

    showVerdict();
  };

  const handleChoice = (choiceIdx: number) => {
    if (answeredRef.current || !item || correctIdx === null) return;
    answeredRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    const now = Math.floor(Date.now() / 1000);
    const elapsed = (now - servedAtRef.current) * 1000;
    const remainingSec = Math.max(0, item.timeSec - (now - servedAtRef.current));
    const isCorrect = choiceIdx === correctIdx;

    let scoreDelta: number;
    if (isCorrect) {
      scoreDelta = Math.round(scoreBase(item.type) * speedMultiplier(remainingSec, item.timeSec));
    } else {
      scoreDelta = PENALTIES[item.type];
    }

    setSelected(choiceIdx);
    setScore(scoreDelta);
    setRtMs(elapsed);

    saveAttempt({
      itemId: item.id,
      domain: item.domain,
      servedAt: servedAtRef.current,
      answeredAt: now,
      rtMs: elapsed,
      choice: choiceIdx,
      correct: isCorrect,
      scoreDelta,
    });

    showVerdict();
  };

  const showVerdict = () => {
    verdictScale.setValue(0.3);
    setPhase('verdict');
    Animated.spring(verdictScale, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Render phases ──

  if (phase === 'loading' || !item) {
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (phase === 'countdown') {
    return (
      <View style={styles.fullCenter}>
        <Animated.Text style={[styles.countdownText, { transform: [{ scale: countScale }] }]}>
          {countNum}
        </Animated.Text>
      </View>
    );
  }

  if (phase === 'answering') {
    const pct = remaining / item.timeSec;
    const timerColor = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Timer bar */}
        <View style={styles.timerContainer}>
          <Animated.View
            style={[
              styles.timerBar,
              {
                backgroundColor: timerColor,
                width: timerWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.timerSeconds}>{remaining}s</Text>

        {/* Question */}
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.questionPrompt}>{item.prompt}</Text>

          {/* Choices */}
          <View style={styles.choices}>
            {item.choices.map((choice, idx) => (
              <Pressable
                key={idx}
                style={styles.choiceBtn}
                onPress={() => handleChoice(idx)}
              >
                <View style={styles.choiceLetter}>
                  <Text style={styles.choiceLetterText}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                </View>
                <Text style={styles.choiceText}>{choice}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Verdict phase ──
  const isCorrect = selected === correctIdx;
  const isTimeout = selected === -1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.verdictContent}>
        {!alreadyDone && (
          <Animated.View style={[styles.verdictIcon, { transform: [{ scale: verdictScale }] }]}>
            <Text style={[styles.verdictEmoji, { color: isCorrect ? '#22c55e' : '#ef4444' }]}>
              {isCorrect ? '✓' : '✗'}
            </Text>
          </Animated.View>
        )}

        {!alreadyDone && (
          <Text style={[styles.scoreDelta, { color: score >= 0 ? '#22c55e' : '#ef4444' }]}>
            {score >= 0 ? '+' : ''}{score} pts
          </Text>
        )}

        {!alreadyDone && !isTimeout && (
          <Text style={styles.reactionTime}>
            {(rtMs / 1000).toFixed(1)}s reaction time
          </Text>
        )}

        {isTimeout && !alreadyDone && (
          <Text style={styles.timeoutText}>Time's up!</Text>
        )}

        {alreadyDone && (
          <Text style={styles.alreadyDoneText}>Already attempted</Text>
        )}

        {/* Question prompt */}
        <Text style={styles.verdictPrompt}>{item.prompt}</Text>

        {/* All choices with highlights */}
        <View style={styles.choices}>
          {item.choices.map((choice, idx) => {
            const isCorrectChoice = idx === correctIdx;
            const isSelectedWrong = idx === selected && !isCorrect;
            return (
              <View
                key={idx}
                style={[
                  styles.choiceResult,
                  isCorrectChoice && styles.choiceCorrect,
                  isSelectedWrong && styles.choiceWrong,
                ]}
              >
                <View
                  style={[
                    styles.choiceLetter,
                    isCorrectChoice && styles.letterCorrect,
                    isSelectedWrong && styles.letterWrong,
                  ]}
                >
                  <Text style={styles.choiceLetterText}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.choiceText,
                    isCorrectChoice && { color: '#22c55e' },
                    isSelectedWrong && { color: '#ef4444' },
                  ]}
                >
                  {choice}
                </Text>
                {isCorrectChoice && <Text style={styles.checkmark}>✓</Text>}
              </View>
            );
          })}
        </View>

        {/* Rationale */}
        {rationale ? (
          <View style={styles.rationaleBox}>
            <Text style={styles.rationaleLabel}>Explanation</Text>
            <Text style={styles.rationaleText}>{rationale}</Text>
          </View>
        ) : null}

        {/* Continue button */}
        <Pressable style={styles.continueBtn} onPress={() => router.back()}>
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  fullCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: { color: '#8888aa', fontSize: 16 },

  // Countdown
  countdownText: {
    fontSize: 96,
    fontWeight: '800',
    color: '#4a6cf7',
  },

  // Timer
  timerContainer: {
    height: 6,
    backgroundColor: '#1a1a2e',
    width: '100%',
  },
  timerBar: { height: 6 },
  timerSeconds: {
    color: '#888',
    fontSize: 14,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Scroll area
  scrollArea: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  verdictContent: { padding: 20, paddingBottom: 60, alignItems: 'center' },

  // Question
  questionPrompt: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
    marginBottom: 24,
  },

  // Choices
  choices: { gap: 10, width: '100%' },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  choiceLetter: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2a2a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceLetterText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  choiceText: { color: '#ddd', fontSize: 15, flex: 1 },

  // Verdict choices
  choiceResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  choiceCorrect: { borderColor: '#22c55e', backgroundColor: '#22c55e11' },
  choiceWrong: { borderColor: '#ef4444', backgroundColor: '#ef444411' },
  letterCorrect: { backgroundColor: '#22c55e' },
  letterWrong: { backgroundColor: '#ef4444' },
  checkmark: { color: '#22c55e', fontSize: 18, fontWeight: '700' },

  // Verdict
  verdictIcon: { marginBottom: 8, marginTop: 20 },
  verdictEmoji: { fontSize: 64, fontWeight: '800' },
  scoreDelta: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  reactionTime: { color: '#888', fontSize: 14, marginBottom: 16 },
  timeoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  alreadyDoneText: { color: '#888', fontSize: 16, marginTop: 20, marginBottom: 16 },
  verdictPrompt: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },

  // Rationale
  rationaleBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: '#4a6cf7',
  },
  rationaleLabel: { color: '#4a6cf7', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  rationaleText: { color: '#bbb', fontSize: 14, lineHeight: 21 },

  // Continue
  continueBtn: {
    backgroundColor: '#4a6cf7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginTop: 28,
    alignSelf: 'center',
  },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
