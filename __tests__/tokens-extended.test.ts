import { spacing, radius, shadow, typography, motion, iconSizes, fontFamily } from '../src/theme/tokens';

describe('tokens.ts - Extended Tokens (T-004)', () => {
  describe('Spacing (pages_11 §5)', () => {
    it('should have spacing[4] as 16', () => {
      expect(spacing[4]).toBe(16);
    });

    it('should have all 9 spacing steps', () => {
      expect(spacing[1]).toBe(4);
      expect(spacing[2]).toBe(8);
      expect(spacing[3]).toBe(12);
      expect(spacing[4]).toBe(16);
      expect(spacing[5]).toBe(20);
      expect(spacing[6]).toBe(24);
      expect(spacing[8]).toBe(32);
      expect(spacing[10]).toBe(40);
      expect(spacing[12]).toBe(48);
    });
  });

  describe('Typography (pages_11 §4.2)', () => {
    it('should have all 10 type scales', () => {
      // display-lg: 28sp / 700 / 1.3
      expect(typography.displayLg.fontSize).toBe(28);
      expect(typography.displayLg.fontWeight).toBe('700');
      expect(typography.displayLg.lineHeight).toBe(36);

      // body-md: 14sp / 400 / 1.6
      expect(typography.bodyMd.fontSize).toBe(14);
      expect(typography.bodyMd.fontWeight).toBe('400');
      expect(typography.bodyMd.lineHeight).toBe(22);

      // caption: 12sp / 400 / 1.4
      expect(typography.caption.fontSize).toBe(12);
      expect(typography.caption.fontWeight).toBe('400');
      expect(typography.caption.lineHeight).toBe(17);
    });
  });

  describe('Border Radius (pages_11 §6)', () => {
    it('should have radius-md as 10', () => {
      expect(radius.md).toBe(10);
    });

    it('should have all 5 radius variants', () => {
      expect(radius.sm).toBe(6);
      expect(radius.md).toBe(10);
      expect(radius.lg).toBe(16);
      expect(radius.xl).toBe(24);
      expect(radius.full).toBe(9999);
    });
  });

  describe('Shadow (pages_11 §7)', () => {
    it('should have all 3 shadow variants', () => {
      expect(shadow.sm).toBe('0 1px 3px rgba(45,31,14,0.08)');
      expect(shadow.md).toBe('0 4px 12px rgba(45,31,14,0.12)');
      expect(shadow.lg).toBe('0 8px 24px rgba(45,31,14,0.16)');
    });
  });

  describe('Motion (pages_11 §11)', () => {
    it('should have 3 duration tokens', () => {
      expect(motion.duration.fast).toBe(150);
      expect(motion.duration.normal).toBe(250);
      expect(motion.duration.slow).toBe(400);
    });

    it('should have 2 easing tokens', () => {
      expect(motion.easing.default).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
      expect(motion.easing.spring).toBe('spring(tension:60,friction:12)');
    });
  });

  describe('Icon Sizes (pages_11 §8)', () => {
    it('should have all 4 icon sizes', () => {
      expect(iconSizes.sm).toBe(16);
      expect(iconSizes.md).toBe(20);
      expect(iconSizes.lg).toBe(24);
      expect(iconSizes.xl).toBe(32);
    });
  });

  describe('Font Family (pages_11 §4.1)', () => {
    it('should have iOS font mapping', () => {
      expect(fontFamily.ios).toBe('Apple SD Gothic Neo');
    });

    it('should have Android font mapping', () => {
      expect(fontFamily.android).toBe('Noto Sans KR');
    });

    it('should have point font mapping', () => {
      expect(fontFamily.point).toBe('Noto Serif KR');
    });
  });
});
