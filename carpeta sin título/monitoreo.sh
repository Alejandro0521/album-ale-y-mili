#!/usr/bin/env zsh
# monitoreo.sh - Imprime la línea de ubicación cada 5 minutos y permite abrir BIOS

IP="189.233.10.12"
UA="curl/8.7.1"
LAT="19.6147"
LON="-98.9436"
CITY="Tepexpan"
URL="http://localhost:8000/?log=true"
INTERVAL=5  # 5 segundos (petición actual)

print_line() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%S.%NZ")
  echo "$ts $IP $UA $LAT $LON $CITY $URL"
}

launch_bios() {
  if [[ -f "tablet_shell.sh" ]]; then
    echo "-- Abriendo BIOS --"
    zsh ./tablet_shell.sh
  else
    echo "No se encuentra 'tablet_shell.sh'."
  fi
}

loops_env=${LOOP_COUNT:-}
test_interval=${OVERRIDE_INTERVAL:-}
if [[ -n $test_interval ]]; then
  INTERVAL=$test_interval
fi

if [[ -n $loops_env ]]; then
  # Modo de prueba con número fijo de iteraciones
  for i in {1..$loops_env}; do
    print_line
    echo "[b] BIOS  [q] Salir  (espera ${INTERVAL}s)"
    if read -t $INTERVAL -k 1 key; then
      case "$key" in
        b|B) launch_bios ;;
        q|Q) echo "Salida solicitada."; exit 0 ;;
        *) ;; # cualquier otra tecla ignora
      esac
    fi
  done
  echo "Fin monitoreo de prueba (LOOP_COUNT=$loops_env)."
  exit 0
fi

# Modo normal infinito
while true; do
  print_line
  echo "[b] BIOS  [q] Salir  (espera ${INTERVAL}s)"
  if read -t $INTERVAL -k 1 key; then
    case "$key" in
      b|B) launch_bios ;;
      q|Q) echo "Salida."; exit 0 ;;
      *) ;;
    esac
  fi
done
