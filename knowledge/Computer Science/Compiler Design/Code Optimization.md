# Code Optimization

Improves generated code without changing observable program behavior.

## Constant Propagation

An optimization technique where known constant values are substituted directly into expressions.

Example:

Before:

```
a = 5
b = 10
c = a * 2 + b
```

After:

```
c = 5 * 2 + 10
```

After evaluation:

```
c = 20
```

Benefits:

- Reduces unnecessary computations
- Enables further compiler optimizations
