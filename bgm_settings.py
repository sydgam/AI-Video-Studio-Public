"""Validated settings shared by the Studio API and offline BGM runner."""
import math
import secrets

SPECS = {
    'steps': (50, 10, 100, int),
    'guidance': (7.0, 0, 15, float),
    'shift': (1.0, 0.1, 5, float),
    'cfgStart': (0.0, 0, 1, float),
    'cfgEnd': (1.0, 0, 1, float),
    'fadeIn': (0.3, 0, 10, float),
    'fadeOut': (1.0, 0, 10, float),
    'normalizationDb': (-1.0, -30, 0, float),
}


def settings(data):
    """Reject invalid numeric settings before a GPU worker starts."""
    result = {}
    for key, (default, low, high, kind) in SPECS.items():
        value = float(data.get(key, default))
        if not math.isfinite(value) or not low <= value <= high or (kind is int and value != int(value)):
            raise ValueError(f'{key}: {low} ~ {high}')
        result[key] = kind(value)
    if result['cfgStart'] > result['cfgEnd']:
        raise ValueError('CFG 시작은 종료보다 클 수 없습니다.')
    for key, default, choices in [('method', 'ode', ('ode', 'sde')), ('sampler', 'euler', ('euler', 'heun'))]:
        result[key] = data.get(key, default)
        if result[key] not in choices:
            raise ValueError(f'Invalid {key}')
    for key, default, limit in [('mode', 'auto', 20), ('lyrics', '', 20000), ('language', 'unknown', 30), ('keyscale', '', 40), ('timesignature', '', 10)]:
        value = data.get(key, default)
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f'Invalid {key}')
        result[key] = value
    if result['mode'] not in ('auto', 'instrumental', 'vocal'):
        raise ValueError('Invalid mode')
    result['normalize'] = data.get('normalize', True)
    if not isinstance(result['normalize'], bool):
        raise ValueError('Invalid normalize')
    return result


def seed(value=None):
    """Choose the actual seed once, then preserve it with the job."""
    if value is None:
        return secrets.randbelow(2147483648)
    number = float(value)
    if not math.isfinite(number) or not 0 <= number <= 2147483647 or number != int(number):
        raise ValueError('Invalid seed')
    return int(number)


def duration(value=30, limited=True):
    """Separate the optional Studio cap from the engine's duration range."""
    if not isinstance(limited, bool):
        raise ValueError('Invalid limitDuration')
    number = float(value)
    maximum = 120 if limited else 600
    if not math.isfinite(number) or number != int(number) or not 10 <= number <= maximum:
        raise ValueError(f'길이는 10~{maximum}초로 입력하세요.')
    return int(number)
