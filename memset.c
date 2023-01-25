void *memset(void *b, int c, unsigned long len)
{
  int           i;
  unsigned char *p = b;
  i = 0;
  while (len > 0)
    {
      *p = c;
      p++;
      len--;
    }
  return b;
}
