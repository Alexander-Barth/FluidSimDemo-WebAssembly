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


void gpu_signal_exception() {
}


void gpu_report_exception(int err) {
}


