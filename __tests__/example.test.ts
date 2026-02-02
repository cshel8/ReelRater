describe('Basic Math Operations', () => {
  // Test 1: Simple assertion
  it('should add two numbers correctly', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  // Test 2: Testing a function
  it('should multiply numbers correctly', () => {
    const multiply = (a: number, b: number) => a * b;
    expect(multiply(3, 4)).toBe(12);
  });

  // Test 3: Testing truthiness
  it('should check truthy and falsy values', () => {
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect(null).toBeNull();
    expect(undefined).toBeUndefined();
  });

  // Test 4: Testing arrays
  it('should check array contents', () => {
    const colors = ['red', 'green', 'blue'];
    expect(colors).toContain('green');
    expect(colors).toHaveLength(3);
  });
});